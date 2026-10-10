import { fmtBaht, fmtDate, fmtDateTime, fmtDuration } from '../lib/format'
import { loanSnapshot, type LoanState } from '../lib/loanMath'
import { useNow } from '../lib/queries'
import type { Loan } from '../lib/types'
import { Card, cx, Row } from './ui'

export const stateLabel: Record<LoanState, { text: string; cls: string }> = {
  not_due: { text: 'ยังไม่ครบกำหนด', cls: 'bg-brand-50 text-brand-700' },
  grace: { text: 'ครบกำหนดแล้ว', cls: 'bg-amber-100 text-amber-800' },
  overdue: { text: 'เลยกำหนด กำลังคิดค่าปรับ', cls: 'bg-red-100 text-danger' },
  pending_review: { text: 'ส่งสลิปครบแล้ว รอตรวจ', cls: 'bg-sky-100 text-sky-800' },
  paid: { text: 'ชำระครบแล้ว', cls: 'bg-emerald-100 text-ok' },
}

export function StateBadge({ state }: { state: LoanState }) {
  const s = stateLabel[state]
  return <span className={cx('inline-block rounded-full px-3 py-1 text-xs font-semibold', s.cls)}>{s.text}</span>
}

/** ตัวนับเป็นวินาที — ก่อนครบกำหนดนับถอยหลัง หลังครบกำหนดนับเวลาที่เลย */
function Countdown({ loan, now }: { loan: Loan; now: number }) {
  const s = loanSnapshot(loan, loan.payments, now)
  if (s.state === 'paid' || s.state === 'pending_review') {
    return (
      <div className="rounded-3xl bg-emerald-50 p-5 text-center">
        <p className="text-sm text-ok">นาฬิกาหยุดแล้วเมื่อ</p>
        <p className="mt-1 text-xl font-bold text-ok">{fmtDateTime(s.settledAt!)}</p>
        {s.state === 'pending_review' && <p className="mt-2 text-sm text-sky-800">รอผู้ดูแลตรวจสลิป</p>}
      </div>
    )
  }
  const overdue = s.msToDue <= 0
  const d = fmtDuration(Math.abs(s.msToDue))
  return (
    <div
      className={cx(
        'rounded-3xl p-5 text-center text-white',
        overdue ? 'bg-gradient-to-br from-[#d92d4b] to-[#ff5a5f]' : 'bg-gradient-to-br from-[#5a2fb8] to-[#8b4cff]',
      )}
    >
      <p className="text-sm opacity-90">{overdue ? 'เลยกำหนดชำระมาแล้ว' : 'เหลือเวลาก่อนครบชำระ'}</p>
      <div className="tabular mt-2 flex items-end justify-center gap-2 font-bold">
        {d.d > 0 && (
          <span className="text-4xl sm:text-5xl">
            {d.d}
            <span className="ml-1 text-base font-semibold">วัน</span>
          </span>
        )}
        <span className="text-4xl sm:text-5xl">
          {String(d.h).padStart(2, '0')}:{String(d.m).padStart(2, '0')}:{String(d.s).padStart(2, '0')}
        </span>
      </div>
      {s.msToNextPenalty !== null && Number(loan.hourly_penalty) > 0 && (
        <p className="mt-3 rounded-full bg-black/15 px-4 py-1.5 text-sm">
          {s.state === 'grace' ? 'เริ่มปรับ' : 'ปรับเพิ่มอีก'} {fmtBaht(Number(loan.hourly_penalty))} ใน{' '}
          <span className="tabular font-semibold">{fmtDuration(s.msToNextPenalty).text}</span>
        </p>
      )}
    </div>
  )
}

export function LoanCard({ loan, actions, live = true }: { loan: Loan; actions?: React.ReactNode; live?: boolean }) {
  const now = useNow(live ? 1000 : 30_000)
  const s = loanSnapshot(loan, loan.payments, now)
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted">ยอดคงเหลือที่ต้องชำระ</p>
          <p className={cx('tabular text-3xl font-bold', s.balance > 0 && s.state === 'overdue' && 'text-danger')}>
            {fmtBaht(s.balance)}
          </p>
        </div>
        <StateBadge state={s.state} />
      </div>

      {live && <Countdown loan={loan} now={now} />}

      <div className="divide-y divide-[#0000000d] text-[15px]">
        <Row label="เงินที่ยืม" value={fmtBaht(Number(loan.principal))} />
        <Row label="วันที่ยืม" value={fmtDate(loan.borrowed_on)} />
        <Row label="วันที่เริ่มคิดดอก" value={fmtDate(loan.interest_start_on)} />
        <Row label="ดอกต่อวัน" value={fmtBaht(Number(loan.daily_interest))} />
        <Row label={`รวมดอก (${s.days} วัน)`} value={fmtBaht(s.interest)} />
        <Row label="วันครบชำระ" value={fmtDateTime(loan.due_at)} />
        <Row label="ค่าปรับต่อชั่วโมง" value={fmtBaht(Number(loan.hourly_penalty))} />
        {s.hours > 0 && <Row label={`ค่าปรับ (${s.hours} ชม.)`} value={<span className="text-danger">{fmtBaht(s.penalty)}</span>} />}
        <Row label="ยอดรวมทั้งหมด" value={fmtBaht(s.total)} />
        {s.approved > 0 && <Row label="ชำระแล้ว" value={<span className="text-ok">− {fmtBaht(s.approved)}</span>} />}
        {s.pending > 0 && <Row label="รอตรวจสลิป" value={<span className="text-sky-700">− {fmtBaht(s.pending)}</span>} />}
        <Row label="คงเหลือ" value={fmtBaht(s.balance)} strong />
      </div>
      {loan.note && <p className="rounded-2xl bg-canvas px-4 py-3 text-sm text-muted">📝 {loan.note}</p>}
      {actions}
    </Card>
  )
}
