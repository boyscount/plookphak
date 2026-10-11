// แบบจ่ายดอกรายวัน: เลือกว่าจ่ายถึงวันไหน — ต้องจ่ายวันเก่าสุดก่อน จึงเลือกเป็นช่วงต่อกันเสมอ
import { useEffect, useMemo } from 'react'
import { fmtBaht } from '../lib/format'
import { dailyPlan, type LoanTerms, type PaymentLike, type PlanDay } from '../lib/loanMath'
import { cx } from './ui'

const dayFmt = new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const fmt = (ymd: string) => dayFmt.format(new Date(`${ymd}T00:00:00Z`))

/** "ดอกวันที่ 7–10 ต.ค." */
export function dayRangeLabel(days: PlanDay[]) {
  if (!days.length) return ''
  const a = new Date(`${days[0].date}T00:00:00Z`)
  const b = new Date(`${days[days.length - 1].date}T00:00:00Z`)
  if (days.length === 1) return `ดอกวันที่ ${fmt(days[0].date)}`
  if (a.getUTCMonth() === b.getUTCMonth()) return `ดอกวันที่ ${a.getUTCDate()}–${fmt(days[days.length - 1].date)}`
  return `ดอกวันที่ ${fmt(days[0].date)} – ${fmt(days[days.length - 1].date)}`
}

export function DayPicker({
  loan,
  payments,
  atMs,
  through,
  onChange,
}: {
  loan: LoanTerms
  payments: PaymentLike[]
  atMs: number
  /** index ของวันสุดท้ายที่เลือก หรือ null */
  through: number | null
  /** ส่งยอดที่ต้องจ่ายและข้อความกำกับกลับไป */
  onChange: (through: number | null, amount: number, note: string) => void
}) {
  const plan = useMemo(() => dailyPlan(loan, payments, atMs, 10), [loan, payments, atMs])
  const open = plan.days.filter((d) => !d.covered)
  const recentPaid = plan.days.filter((d) => d.covered).slice(-3)
  const shown = [...recentPaid, ...open.slice(0, 14)]

  const select = (k: number | null) => {
    if (k === null) return onChange(null, 0, '')
    const picked = open.filter((d) => d.index <= k)
    const amount = plan.amountThrough(k)
    const withPrincipal = !plan.principalCovered && Date.parse(loan.due_at) <= (plan.days.find((d) => d.index === k)?.at ?? 0)
    onChange(k, amount, dayRangeLabel(picked) + (withPrincipal ? ' + คืนเงินต้น' : ''))
  }

  // ค่าเริ่มต้น: วันที่ค้างทั้งหมด + วันนี้ (ถ้ายังไม่จ่าย) ไม่งั้นวันถัดไปวันเดียว
  useEffect(() => {
    if (through !== null || !open.length) return
    const todayOpen = open.find((d) => d.today)
    const lastOverdue = [...open].reverse().find((d) => d.overdue)
    select(todayOpen?.index ?? lastOverdue?.index ?? open[0].index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open.length])

  const picked = open.filter((d) => through !== null && d.index <= through)

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-semibold">จ่ายดอกถึงวันไหน</span>
        <span className="text-muted">{plan.paidThrough ? `จ่ายแล้วถึง ${fmt(plan.paidThrough)}` : 'ยังไม่เคยจ่าย'}</span>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {shown.map((d) => {
          const on = !d.covered && through !== null && d.index <= through
          return (
            <button
              key={d.index}
              type="button"
              disabled={d.covered}
              onClick={() => select(through === d.index ? null : d.index)}
              aria-pressed={on}
              className={cx(
                'flex w-14 shrink-0 flex-col items-center rounded-2xl py-2 text-xs font-semibold transition',
                d.covered && 'bg-emerald-100 text-ok',
                !d.covered && !on && (d.overdue ? 'bg-red-100 text-danger' : 'bg-pill text-ink'),
                on && 'bg-brand-600 text-white shadow-[0_6px_14px_-6px_#7432ea]',
                d.today && !on && 'ring-2 ring-brand-400',
              )}
            >
              <span className="text-[11px] opacity-80">{d.today ? 'วันนี้' : fmt(d.date).split(' ')[1]}</span>
              <span className="text-lg leading-tight">{new Date(`${d.date}T00:00:00Z`).getUTCDate()}</span>
              <span className="text-[11px]">{d.covered ? '✓ จ่ายแล้ว' : d.overdue ? 'ค้าง' : fmtBaht(d.amount)}</span>
            </button>
          )
        })}
      </div>
      {picked.length > 0 ? (
        <p className="mt-2 rounded-2xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {dayRangeLabel(picked)} ({picked.length} วัน) = <b className="tabular">{fmtBaht(plan.amountThrough(through!))}</b>
          {plan.amountThrough(through!) > picked.length * Number(loan.daily_interest) + 0.001 && ' (รวมเงินต้นที่ครบกำหนดแล้ว)'}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">แตะวันสุดท้ายที่จะจ่าย ระบบเลือกวันที่ค้างก่อนหน้าให้อัตโนมัติ</p>
      )}
    </div>
  )
}
