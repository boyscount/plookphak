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
  /** แบบพร้อมเงินต้น: ปรับต่อชั่วโมง (เดิม) หรือต่อวัน — ยอดต่อหน่วยอยู่ใน hourly_penalty. ไม่ระบุ = hour */
  penalty_unit?: PenaltyUnit
}

export type PenaltyUnit = 'hour' | 'day'

/** ข้อความหน่วยค่าปรับ: per = 'ต่อวัน' | 'ต่อชั่วโมง', short = 'วัน' | 'ชม.' */
export function penaltyWords(loan: LoanTerms) {
  const day = penaltyUnitOf(loan) === 'day'
  return { per: day ? 'ต่อวัน' : 'ต่อชั่วโมง', short: day ? 'วัน' : 'ชม.', slash: day ? '/วัน' : '/ชม.' }
}

/** หน่วยค่าปรับที่ใช้จริง: แบบรายวันปรับรายชั่วโมงเสมอ */
export function penaltyUnitOf(loan: LoanTerms): PenaltyUnit {
  return loan.interest_mode !== 'daily' && loan.penalty_unit === 'day' ? 'day' : 'hour'
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

/**
 * จำนวนครั้งที่โดนปรับ (แบบดอกพร้อมเงินต้น)
 * - ต่อชั่วโมง: ชั่วโมงเต็มที่เลยกำหนด (ครบ 1 ชม. แรกจึงเริ่มปรับ)
 * - ต่อวัน: เลยกำหนดปุ๊บนับ 1 ทันที แล้ว +1 ทุก 24 ชม.
 */
export function penaltyHours(loan: LoanTerms, atMs: number): number {
  const late = atMs - Date.parse(loan.due_at)
  if (penaltyUnitOf(loan) === 'day') return late > 0 ? Math.floor(late / DAY) + 1 : 0
  return Math.max(0, Math.floor(late / HOUR))
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
    /** จำนวนครั้งที่ปรับ — ชั่วโมง หรือวัน ตาม penaltyUnitOf(loan) */
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
  const unit = penaltyUnitOf(loan)
  const step = unit === 'day' ? DAY : HOUR
  if (settled !== null) state = pending > 0 ? 'pending_review' : 'paid'
  else if (lateSince === null) state = 'not_due'
  else if (unit === 'hour' && nowMs < lateSince + HOUR) state = 'grace'
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
    msToNextPenalty: lateSince !== null ? step - ((nowMs - lateSince) % step) : null,
    /** หน่วยค่าปรับ: hour | day */
    penaltyUnit: unit,
  }
}

export type DayStatus = 'on_time' | 'late' | 'missed' | 'today' | 'none'

/** แบบรายวัน: สถานะการจ่ายดอกของแต่ละวัน ย้อนหลัง n วัน (รวมวันนี้) */
export function dailyHistory(loan: LoanTerms, payments: PaymentLike[], nowMs: number, n = 14) {
  const pays = validPayments(payments)
  const paidBy = (t: number) => pays.filter((p) => p.at <= t).reduce((s, p) => s + p.amount, 0)
  const paidNow = paidBy(nowMs)
  const startDay = dateDayNumber(loan.interest_start_on)
  const today = bkkDayNumber(nowMs)
  const dueMs = Date.parse(loan.due_at)
  const out: { day: number; date: string; status: DayStatus }[] = []
  for (let d = today - n + 1; d <= today; d++) {
    const date = new Date(d * DAY).toISOString().slice(0, 10)
    const i = d - startDay
    if (i < 0) {
      out.push({ day: d, date, status: 'none' })
      continue
    }
    const cutoff = cutoffAt(loan, i)
    // ยอดที่ต้องจ่ายครบภายในตัดรอบวันนั้น (ดอกทุกวันถึงวันนั้น + เงินต้นถ้าครบกำหนดแล้ว)
    const base = Number(loan.daily_interest) * (i + 1) + (dueMs <= cutoff ? Number(loan.principal) : 0)
    let status: DayStatus
    if (paidBy(cutoff) >= base - 1e-9) status = 'on_time'
    else if (cutoff > nowMs) status = 'today'
    else if (paidNow >= base - 1e-9) status = 'late'
    else status = 'missed'
    out.push({ day: d, date, status })
  }
  return out
}

export type PlanDay = {
  index: number
  date: string // YYYY-MM-DD ตามเวลาไทย
  at: number // เวลาตัดรอบ
  amount: number
  covered: boolean
  overdue: boolean
  today: boolean
}

/**
 * แบบรายวัน: แต่ละวันจ่ายแล้วหรือยัง (นับตามลำดับเวลา: เงินที่จ่ายตัดวันเก่าสุดก่อน เหมือนตัวคำนวณค่าปรับ)
 * ใช้ทำปุ่มเลือกวันตอนอัปสลิป และบอกว่าจ่ายถึงวันไหนแล้ว
 */
export function dailyPlan(loan: LoanTerms, payments: PaymentLike[], nowMs: number, aheadDays = 7) {
  const startDay = dateDayNumber(loan.interest_start_on)
  const today = bkkDayNumber(nowMs)
  // นับทุกการจ่ายที่ไม่ถูกปฏิเสธ (รวมที่เพิ่งบันทึกหลังเปิดหน้า — เวลาเซิร์ฟเวอร์อาจเดินหน้ากว่าเครื่อง)
  const paid = validPayments(payments).reduce((s, p) => s + p.amount, 0)
  const dueMs = Date.parse(loan.due_at)
  const principal = Number(loan.principal)
  const rate = Number(loan.daily_interest)

  type Ob = { at: number; amount: number; day?: number }
  const obs: Ob[] = []
  for (let d = startDay; d <= today + aheadDays; d++) obs.push({ at: cutoffAt(loan, d - startDay), amount: rate, day: d })
  obs.push({ at: dueMs, amount: principal })
  obs.sort((a, b) => a.at - b.at)

  let cum = 0
  const days: PlanDay[] = []
  let principalCovered = false
  let principalAfterDay = -1 // เงินต้นครบกำหนดหลังวันที่ index นี้
  for (const o of obs) {
    cum += o.amount
    const covered = cum <= paid + 1e-9
    if (o.day === undefined) {
      principalCovered = covered
      principalAfterDay = days.length - 1
      continue
    }
    days.push({
      index: o.day - startDay,
      date: new Date(o.day * DAY).toISOString().slice(0, 10),
      at: o.at,
      amount: rate,
      covered,
      overdue: !covered && o.at <= nowMs,
      today: o.day === today,
    })
  }

  /** ยอดที่ต้องจ่ายเพื่อให้ครอบคลุมถึงวัน k (รวมวันก่อนหน้าที่ยังค้าง และเงินต้นถ้าครบกำหนดก่อนวันนั้น) */
  const amountThrough = (k: number) => {
    const day = days.find((d) => d.index === k)
    if (!day) return 0
    const base = rate * (k + 1) + (dueMs <= day.at ? principal : 0)
    return Math.max(0, round2(base - paid))
  }

  const lastCovered = [...days].reverse().find((d) => d.covered) ?? null
  const firstOpen = days.find((d) => !d.covered) ?? null
  return {
    days,
    paid: round2(paid),
    paidThrough: lastCovered?.date ?? null,
    firstOpen,
    principalCovered,
    principalAfterDay,
    amountThrough,
  }
}
