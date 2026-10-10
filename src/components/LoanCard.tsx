import { fmtBaht, fmtDate, fmtDateTime, fmtDuration } from '../lib/format'
import { dailyHistory, dailyPlan, loanSnapshot, type LoanState } from '../lib/loanMath'
import { Confetti, CountUpBaht, DayStrip, MONEY_COLORS, ProgressRing, StackedBar } from './charts'
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
  // แบบรายวัน: นับถึงตัดรอบถัดไป หรือนับเวลาที่ค้าง; แบบพร้อมต้น: นับถึง/หลังวันครบชำระ
  let late: boolean
  let ms: number
  let title: string
  let sub: string | null = null
  if (s.daily) {
    late = s.lateSince !== null
    ms = late ? now - s.lateSince! : s.nextDue ? s.nextDue.at - now : 0
    title = late ? 'ค้างชำระมาแล้ว' : 'เหลือเวลาก่อนตัดรอบ'
    sub = late
      ? `ค้าง ${fmtBaht(s.arrearsAmount)} — อัปสลิปเพื่อหยุดค่าปรับ`
      : s.nextDue
        ? `ต้องจ่าย ${fmtBaht(s.nextDue.amount)} ภายใน ${fmtDateTime(s.nextDue.at)}`
        : null
  } else {
    late = s.msToDue <= 0
    ms = Math.abs(s.msToDue)
    title = late ? 'เลยกำหนดชำระมาแล้ว' : 'เหลือเวลาก่อนครบชำระ'
  }
  const d = fmtDuration(ms)
  return (
    <div
      className={cx(
        'rounded-3xl p-5 text-center text-white',
        late ? 'bg-gradient-to-br from-[#d92d4b] to-[#ff5a5f]' : 'bg-gradient-to-br from-[#5a2fb8] to-[#8b4cff]',
      )}
    >
      <p className="text-sm opacity-90">{title}</p>
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
      {sub && <p className="mt-2 text-sm font-medium">{sub}</p>}
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
  const plan = s.daily ? dailyPlan(loan, loan.payments, now) : null
  // แบบรายวัน: ยอดที่ต้องจ่ายตอนนี้ = ค้างอยู่ทั้งหมด หรือดอกรอบถัดไป
  const roundDue = s.arrearsAmount > 0 ? s.arrearsAmount : (s.nextDue?.amount ?? 0)
  return (
    <Card className="rise-in space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted">{plan && s.balance > 0 ? (s.arrearsAmount > 0 ? 'ดอกค้างที่ต้องจ่าย' : 'ดอกรอบถัดไป') : 'ยอดคงเหลือที่ต้องชำระ'}</p>
          <CountUpBaht
            value={plan && s.balance > 0 ? roundDue : s.balance}
            className={cx('block text-3xl font-bold', s.balance > 0 && s.state === 'overdue' && 'text-danger')}
          />
        </div>
        <StateBadge state={s.state} />
      </div>

      {live && <Countdown loan={loan} now={now} />}

      <div className="rounded-3xl bg-canvas p-4">
        <div className="flex items-center gap-4">
          <ProgressRing value={s.total > 0 ? (s.total - s.balance) / s.total : 0} size={76} stroke={8} />
          <div className="min-w-0">
            <p className="text-sm text-muted">จ่ายแล้ว</p>
            <p className="tabular text-lg font-bold">
              {fmtBaht(s.total - s.balance)} <span className="text-sm font-medium text-muted">จาก {fmtBaht(s.total)}</span>
            </p>
          </div>
        </div>
        <div className="mt-4">
          <StackedBar
            height={10}
            segments={[
              { key: 'p', label: 'เงินต้น', value: Number(loan.principal), color: MONEY_COLORS.principal },
              { key: 'i', label: 'ดอกเบี้ย', value: s.interest, color: MONEY_COLORS.interest },
              { key: 'f', label: 'ค่าปรับ', value: s.penalty, color: MONEY_COLORS.penalty },
            ]}
          />
        </div>
      </div>

      {s.daily && live && <DayStrip days={dailyHistory(loan, loan.payments, now, 14).filter((d) => d.status !== 'none')} />}
      {live && s.state === 'paid' && <Confetti id={loan.id} />}

      <div className="divide-y divide-line text-[15px]">
        <Row label="รูปแบบการจ่ายดอกเบี้ย" value={s.daily ? `รายวัน ก่อน ${(loan.daily_cutoff ?? '17:00').slice(0, 5)} น.` : 'พร้อมเงินต้น'} />
        <Row label="จำนวนเงินที่ยืม" value={fmtBaht(Number(loan.principal))} />
        <Row label="วันที่ยืม" value={fmtDate(loan.borrowed_on)} />
        <Row label="วันที่เริ่มคิดดอกเบี้ย" value={fmtDate(loan.interest_start_on)} />
        <Row label="ดอกเบี้ยต่อวัน" value={fmtBaht(Number(loan.daily_interest))} />
        {plan ? (
          <>
            {/* แบบรายวัน: ดอกที่จ่ายไปแล้วไม่ต้องนับรวมอีก — โชว์แค่ถึงวันไหน และรอบถัดไปเท่าไร */}
            <Row
              label="จ่ายดอกแล้ว"
              value={plan.paidThrough ? `ถึง ${fmtDate(plan.paidThrough)} (${plan.days.filter((d) => d.covered).length} วัน)` : 'ยังไม่ได้จ่าย'}
            />
            {s.arrearsAmount > 0 && (
              <Row
                label={`ดอกค้าง (${plan.days.filter((d) => d.overdue).length} วัน)`}
                value={<span className="text-danger">{fmtBaht(s.arrearsAmount)}</span>}
              />
            )}
            <Row label="วันครบคืนเงินต้น" value={fmtDateTime(loan.due_at)} />
            <Row label="เงินต้นคงเหลือ" value={plan.principalCovered ? <span className="text-ok">คืนแล้ว</span> : fmtBaht(Number(loan.principal))} />
            <Row label="ค่าปรับต่อชั่วโมง" value={fmtBaht(Number(loan.hourly_penalty))} />
            {s.penalty > 0 && (
              <Row
                label={`ค่าปรับสะสม (${s.hours} ชม.)`}
                value={<span className="text-danger">{fmtBaht(s.penalty)}</span>}
              />
            )}
            {s.pending > 0 && <Row label="รอตรวจสลิป" value={<span className="text-sky-700">{fmtBaht(s.pending)}</span>} />}
            {s.nextDue && s.balance > 0 && (
              <Row
                label={s.arrearsAmount > 0 ? 'ต้องจ่ายตอนนี้ (เลยรอบแล้ว)' : `ต้องจ่ายภายใน ${fmtDateTime(s.nextDue.at)}`}
                value={<span className={s.arrearsAmount > 0 ? 'text-danger' : ''}>{fmtBaht(roundDue)}</span>}
                strong
              />
            )}
            <Row label="ปิดยอดทั้งหมดตอนนี้" value={<span className="text-muted">{fmtBaht(s.balance)}</span>} />
          </>
        ) : (
          <>
            <Row label="รวมดอกเบี้ยที่ต้องชำระ" value={<>{fmtBaht(s.interest)} <span className="text-sm text-muted">({s.days} วัน)</span></>} />
            <Row label="วันครบกำหนดชำระ" value={fmtDateTime(loan.due_at)} />
            <Row label="ค่าปรับต่อชั่วโมง" value={fmtBaht(Number(loan.hourly_penalty))} />
            {s.hours > 0 && <Row label={`ค่าปรับ (${s.hours} ชม.)`} value={<span className="text-danger">{fmtBaht(s.penalty)}</span>} />}
            <Row label="จำนวนเงินที่ต้องชำระ" value={fmtBaht(s.total)} />
            {s.approved > 0 && <Row label="ชำระแล้ว" value={<span className="text-ok">− {fmtBaht(s.approved)}</span>} />}
            {s.pending > 0 && <Row label="รอตรวจสลิป" value={<span className="text-sky-700">− {fmtBaht(s.pending)}</span>} />}
            <Row label="คงเหลือ" value={fmtBaht(s.balance)} strong />
          </>
        )}
      </div>
      {loan.note && <p className="rounded-2xl bg-canvas px-4 py-3 text-sm text-muted">📝 {loan.note}</p>}
      {actions}
    </Card>
  )
}
