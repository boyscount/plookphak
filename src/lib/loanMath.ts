// ต้องตรงกับ public.loan_totals / public.loan_settled_at ใน supabase/migrations

export type InterestMode = 'with_principal' | 'daily'

export type LoanTerms = {
  principal: number
  interest_start_on: string // YYYY-MM-DD (วันตามเวลาไทย)
  daily_interest: number
  due_at: string // ISO timestamp
  hourly_penalty: number
  interest_mode?: InterestMode // ไม่ระบุ = with_principal
  daily_cutoff?: string // 'HH:MM' หรือ 'HH:MM:SS' เวลาไทย, ใช้กับแบบรายวัน
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

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** จำนวนวันที่คิดดอก: วันเริ่มคิดดอกนับเป็นวันที่ 1 */
export function interestDays(loan: LoanTerms, atMs: number): number {
  return Math.max(0, bkkDayNumber(atMs) - dateDayNumber(loan.interest_start_on) + 1)
}

/** เวลาตัดรอบดอกของวันที่ i (0 = วันเริ่มคิดดอก) */
function cutoffAt(loan: LoanTerms, i: number): number {
  const cutoff = (loan.daily_cutoff ?? '17:00').slice(0, 5)
  return (dateDayNumber(loan.interest_start_on) + i) * DAY + Date.parse(`1970-01-01T${cutoff}:00Z`) - BKK_OFFSET
}

type Obligation = { at: number; amount: number }

/** ก้อนที่ต้องจ่ายตามกำหนด (ไม่รวมค่าปรับ) เรียงตามเวลา จนถึง untilMs */
function obligations(loan: LoanTerms, untilMs: number): Obligation[] {
  const out: Obligation[] = []
  const lastDay = bkkDayNumber(untilMs) - dateDayNumber(loan.interest_start_on)
  for (let i = 0; i <= lastDay; i++) {
    const at = cutoffAt(loan, i)
    if (at <= untilMs) out.push({ at, amount: Number(loan.daily_interest) })
  }
  const due = Date.parse(loan.due_at)
  if (due <= untilMs) out.push({ at: due, amount: Number(loan.principal) })
  return out.sort((a, b) => a.at - b.at)
}

function validPayments(payments: PaymentLike[]) {
  return payments
    .filter((p) => p.status !== 'rejected')
    .map((p) => ({ at: Date.parse(p.paid_at), created: Date.parse(p.created_at ?? p.paid_at), amount: Number(p.amount) }))
    .sort((a, b) => a.at - b.at || a.created - b.created)
}

/**
 * แบบรายวัน: ค่าปรับเดินเมื่อยอดที่ถึงกำหนดแล้ว (ดอกที่เลยตัดรอบ + เงินต้นที่เลยวันครบ)
 * มากกว่ายอดที่จ่ายแล้ว ช่วงค้างแต่ละช่วงนับชั่วโมงเต็ม ค่าปรับคิดรวมก้อนเดียวไม่ว่าค้างกี่วัน
 * เวลาเท่ากัน: นับการจ่ายก่อนการถึงกำหนด (จ่ายตรงเวลาตัดรอบพอดีถือว่าทัน)
 */
function dailyArrears(loan: LoanTerms, payments: PaymentLike[], atMs: number) {
  type Ev = { at: number; kind: 0 | 1; amount: number }
  const evs: Ev[] = [
    ...validPayments(payments)
      .filter((p) => p.at <= atMs)
      .map((p) => ({ at: p.at, kind: 0 as const, amount: p.amount })),
    ...obligations(loan, atMs).map((o) => ({ at: o.at, kind: 1 as const, amount: o.amount })),
  ].sort((a, b) => a.at - b.at || a.kind - b.kind)

  let base = 0
  let paid = 0
  let hours = 0
  let since: number | null = null
  for (const e of evs) {
    if (e.kind === 0) paid += e.amount
    else base += e.amount
    if (paid < base - 1e-9 && since === null) since = e.at
    else if (paid >= base - 1e-9 && since !== null) {
      hours += Math.floor((e.at - since) / HOUR)
      since = null
    }
  }
  if (since !== null) hours += Math.floor((atMs - since) / HOUR)
  return { hours, since, baseDue: round2(base), paid: round2(paid) }
}

/** จำนวนชั่วโมงเต็มที่เลยกำหนด (แบบดอกพร้อมเงินต้น): ครบ 1 ชม. แรกจึงเริ่มปรับ */
export function penaltyHours(loan: LoanTerms, atMs: number): number {
  return Math.max(0, Math.floor((atMs - Date.parse(loan.due_at)) / HOUR))
}

export function owedAt(loan: LoanTerms, payments: PaymentLike[], atMs: number) {
  const days = interestDays(loan, atMs)
  const daily = loan.interest_mode === 'daily'
  const arrears = daily ? dailyArrears(loan, payments, atMs) : null
  const hours = arrears ? arrears.hours : penaltyHours(loan, atMs)
  const interest = round2(Number(loan.daily_interest) * days)
  const penalty = round2(Number(loan.hourly_penalty) * hours)
  return {
    days,
    hours,
    interest,
    penalty,
    total: round2(Number(loan.principal) + interest + penalty),
    arrears,
  }
}

/** เวลาที่จ่ายครบทั้งหมด (นับสลิปรอตรวจด้วย) หรือ null ถ้ายังไม่ครบ */
export function settledAt(loan: LoanTerms, payments: PaymentLike[]): number | null {
  let total = 0
  for (const p of validPayments(payments)) {
    total += p.amount
    if (total >= owedAt(loan, payments, p.at).total - 1e-9) return p.at
  }
  return null
}

export type LoanState = 'not_due' | 'grace' | 'overdue' | 'pending_review' | 'paid'

/** แบบรายวัน: รอบถัดไปที่ต้องจ่าย และต้องจ่ายอีกเท่าไรจึงไม่ค้าง */
function nextDailyDue(loan: LoanTerms, paidNow: number, nowMs: number) {
  const horizon = nowMs + 400 * DAY
  let cum = 0
  for (const o of obligations(loan, horizon)) {
    cum += o.amount
    if (o.at > nowMs && cum > paidNow + 1e-9) return { at: o.at, amount: round2(cum - paidNow) }
  }
  return null
}

export function loanSnapshot(loan: LoanTerms, payments: PaymentLike[], nowMs: number) {
  const settled = settledAt(loan, payments)
  const at = settled ?? nowMs
  const owed = owedAt(loan, payments, at)
  const valid = payments.filter((p) => p.status !== 'rejected')
  const approved = round2(valid.filter((p) => p.status === 'approved').reduce((s, p) => s + Number(p.amount), 0))
  const pending = round2(valid.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0))
  const balance = Math.max(0, round2(owed.total - approved - pending))
  const dueMs = Date.parse(loan.due_at)
  const daily = loan.interest_mode === 'daily'

  // จุดที่เริ่มค้าง: แบบรายวันมาจากการไล่ยอด แบบพร้อมเงินต้นคือวันครบชำระ
  const lateSince = settled !== null ? null : daily ? (owed.arrears?.since ?? null) : nowMs >= dueMs ? dueMs : null

  let state: LoanState
  if (settled !== null) state = pending > 0 ? 'pending_review' : 'paid'
  else if (lateSince === null) state = 'not_due'
  else if (nowMs < lateSince + HOUR) state = 'grace'
  else state = 'overdue'

  const next = daily && settled === null ? nextDailyDue(loan, owed.arrears?.paid ?? 0, nowMs) : null

  return {
    ...owed,
    settledAt: settled,
    approved,
    pending,
    balance,
    state,
    daily,
    /** ms ถึงวันครบชำระเงินต้น (ติดลบ = เลยแล้ว) */
    msToDue: dueMs - nowMs,
    /** เริ่มค้างตั้งแต่เมื่อไร (null = ไม่ค้าง) */
    lateSince,
    /** ยอดที่ถึงกำหนดแล้วแต่ยังไม่จ่าย (แบบรายวัน, ไม่รวมค่าปรับ) */
    arrearsAmount: daily && owed.arrears ? Math.max(0, round2(owed.arrears.baseDue - owed.arrears.paid)) : 0,
    /** แบบรายวัน: รอบถัดไป */
    nextDue: next,
    /** ms ถึงการปรับครั้งถัดไป เมื่อกำลังค้าง */
    msToNextPenalty: lateSince !== null ? HOUR - ((nowMs - lateSince) % HOUR) : null,
  }
}
