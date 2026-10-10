// ต้องตรงกับ public.loan_owed / public.loan_settled_at ใน supabase/migrations

export type LoanTerms = {
  principal: number
  interest_start_on: string // YYYY-MM-DD (วันตามเวลาไทย)
  daily_interest: number
  due_at: string // ISO timestamp
  hourly_penalty: number
}

export type PaymentLike = {
  amount: number
  paid_at: string
  status: 'pending' | 'approved' | 'rejected'
  created_at?: string
}

const HOUR = 3_600_000
const DAY = 86_400_000
const BKK_OFFSET = 7 * HOUR

/** เลขวันแบบนับต่อเนื่องของวันที่ตามเวลาไทย */
function bkkDayNumber(ms: number): number {
  return Math.floor((ms + BKK_OFFSET) / DAY)
}

function dateDayNumber(ymd: string): number {
  return Math.floor(Date.parse(`${ymd}T00:00:00Z`) / DAY)
}

/** จำนวนวันที่คิดดอก: วันเริ่มคิดดอกนับเป็นวันที่ 1 */
export function interestDays(loan: LoanTerms, atMs: number): number {
  return Math.max(0, bkkDayNumber(atMs) - dateDayNumber(loan.interest_start_on) + 1)
}

/** จำนวนชั่วโมงเต็มที่เลยกำหนด: ครบ 1 ชม. แรกจึงเริ่มปรับ */
export function penaltyHours(loan: LoanTerms, atMs: number): number {
  return Math.max(0, Math.floor((atMs - Date.parse(loan.due_at)) / HOUR))
}

export function owedAt(loan: LoanTerms, atMs: number) {
  const days = interestDays(loan, atMs)
  const hours = penaltyHours(loan, atMs)
  const interest = round2(Number(loan.daily_interest) * days)
  const penalty = round2(Number(loan.hourly_penalty) * hours)
  return {
    days,
    hours,
    interest,
    penalty,
    total: round2(Number(loan.principal) + interest + penalty),
  }
}

/** เวลาที่จ่ายครบ (นับสลิปรอตรวจด้วย) หรือ null ถ้ายังไม่ครบ */
export function settledAt(loan: LoanTerms, payments: PaymentLike[]): number | null {
  const sorted = payments
    .filter((p) => p.status !== 'rejected')
    .sort(
      (a, b) =>
        Date.parse(a.paid_at) - Date.parse(b.paid_at) ||
        Date.parse(a.created_at ?? a.paid_at) - Date.parse(b.created_at ?? b.paid_at),
    )
  let total = 0
  for (const p of sorted) {
    total += Number(p.amount)
    const at = Date.parse(p.paid_at)
    if (total >= owedAt(loan, at).total - 1e-9) return at
  }
  return null
}

export type LoanState = 'not_due' | 'grace' | 'overdue' | 'pending_review' | 'paid'

export function loanSnapshot(loan: LoanTerms, payments: PaymentLike[], nowMs: number) {
  const settled = settledAt(loan, payments)
  const at = settled ?? nowMs
  const owed = owedAt(loan, at)
  const approved = sum(payments.filter((p) => p.status === 'approved'))
  const pending = sum(payments.filter((p) => p.status === 'pending'))
  const balance = Math.max(0, round2(owed.total - approved - pending))
  const dueMs = Date.parse(loan.due_at)

  let state: LoanState
  if (settled !== null) state = pending > 0 ? 'pending_review' : 'paid'
  else if (nowMs < dueMs) state = 'not_due'
  else if (nowMs < dueMs + HOUR) state = 'grace'
  else state = 'overdue'

  return {
    ...owed,
    settledAt: settled,
    approved,
    pending,
    balance,
    state,
    /** ms ถึงวันครบชำระ (ติดลบ = เลยแล้ว) */
    msToDue: dueMs - nowMs,
    /** ms ถึงการปรับครั้งถัดไป เมื่อยังไม่จ่ายครบ */
    msToNextPenalty: settled === null && nowMs >= dueMs ? HOUR - ((nowMs - dueMs) % HOUR) : null,
  }
}

function sum(ps: PaymentLike[]) {
  return round2(ps.reduce((s, p) => s + Number(p.amount), 0))
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
