// การ์ด "ต้องทำอะไรต่อ" บนสุดของหน้าผู้ยืม — บอกยอดเดียวที่สำคัญที่สุด เส้นตาย และปุ่มจ่าย
import { fmtBaht, fmtDuration } from '../lib/format'
import { loanSnapshot } from '../lib/loanMath'
import type { Loan } from '../lib/types'
import { cx } from './ui'

type Snap = ReturnType<typeof loanSnapshot>
type Action = { loan: Loan; s: Snap; late: boolean; amount: number; deadline: number }

const timeFmt = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })
const bkkDay = (ms: number) => Math.floor((ms + 7 * 3_600_000) / 86_400_000)

/** "วันนี้ 17:00" / "พรุ่งนี้ 17:00" / "14 ต.ค. 17:00" */
export function whenLabel(at: number, now: number) {
  const diff = bkkDay(at) - bkkDay(now)
  const day = diff === 0 ? 'วันนี้' : diff === 1 ? 'พรุ่งนี้' : dayFmt.format(at)
  return `${day} ${timeFmt.format(at)}`
}

/** รายการที่ต้องจ่ายก่อน: ที่ค้างอยู่ (ค้างนานสุดก่อน) แล้วตามเส้นตายที่ใกล้สุด */
export function pickActions(loans: Loan[], now: number): Action[] {
  const out: Action[] = []
  for (const loan of loans) {
    const s = loanSnapshot(loan, loan.payments, now)
    if (s.balance <= 0) continue
    const late = s.lateSince !== null
    const dueMs = Date.parse(loan.due_at)
    if (s.daily) {
      out.push({ loan, s, late, amount: late ? s.arrearsAmount || s.balance : (s.nextDue?.amount ?? s.balance), deadline: late ? s.lateSince! : (s.nextDue?.at ?? dueMs) })
    } else {
      out.push({ loan, s, late, amount: s.balance, deadline: dueMs })
    }
  }
  return out.sort((a, b) => Number(b.late) - Number(a.late) || a.deadline - b.deadline)
}

export function NextAction({ loans, now, onPay }: { loans: Loan[]; now: number; onPay: (loanId: string) => void }) {
  const actions = pickActions(loans, now)
  const pending = loans.flatMap((l) => l.payments).filter((p) => p.status === 'pending')
  const pendingSum = pending.reduce((s, p) => s + Number(p.amount), 0)
  const pendingLine = pending.length > 0 && (
    <p className="mt-3 rounded-2xl bg-black/15 px-3 py-2 text-sm">
      📩 ส่งสลิปแล้ว {fmtBaht(pendingSum)} · รอผู้ดูแลตรวจ
    </p>
  )

  if (actions.length === 0) {
    return (
      <section
        className={cx(
          'rise-in rounded-3xl p-5 text-white shadow-lg',
          pending.length ? 'bg-gradient-to-br from-[#2563c9] to-[#3fa4ff]' : 'bg-gradient-to-br from-[#118a5e] to-[#2fc48d]',
        )}
      >
        <p className="text-sm font-medium opacity-90">สถานะตอนนี้</p>
        <p className="mt-1 text-2xl font-bold">{pending.length ? 'ไม่ต้องจ่ายเพิ่ม รอตรวจสลิป' : 'ไม่มียอดต้องจ่าย 🌸'}</p>
        {pendingLine || <p className="mt-2 text-sm opacity-90">ขอบคุณที่จ่ายตรงเวลา</p>}
      </section>
    )
  }

  const top = actions[0]
  const { s, loan } = top
  const penalty = Number(loan.hourly_penalty)
  const remain = fmtDuration(top.deadline - now)
  const title = top.late
    ? s.state === 'grace'
      ? 'เลยเวลาแล้ว · ยังไม่เริ่มปรับ'
      : 'เลยกำหนด · ค่าปรับกำลังเดิน'
    : s.daily
      ? 'ดอกรอบนี้ที่ต้องจ่าย'
      : 'ยอดปิดบัญชีที่ต้องจ่าย'

  return (
    <section
      aria-live="polite"
      className={cx(
        'rise-in rounded-3xl p-5 text-white shadow-lg',
        top.late ? 'bg-gradient-to-br from-[#c4213f] to-[#ff5a5f]' : 'bg-gradient-to-br from-[#4f28a8] to-[#8b4cff]',
      )}
    >
      <p className="text-sm font-medium opacity-90">{title}</p>
      <p className="tabular mt-1 text-4xl font-bold tracking-tight sm:text-5xl">{fmtBaht(top.amount)}</p>

      {top.late ? (
        penalty > 0 &&
        s.msToNextPenalty !== null && (
          <p className="mt-2 text-[15px]">
            {s.state === 'grace' ? 'เริ่มปรับ' : 'ปรับเพิ่ม'} +{fmtBaht(penalty)} ใน{' '}
            <span className="tabular font-bold">{fmtDuration(s.msToNextPenalty).text}</span>
          </p>
        )
      ) : (
        <p className="mt-2 text-[15px]">
          ภายใน <span className="font-bold">{whenLabel(top.deadline, now)}</span> · เหลือ{' '}
          <span className="tabular font-bold">{remain.text}</span>
        </p>
      )}

      <button
        type="button"
        onClick={() => onPay(loan.id)}
        className="mt-4 min-h-12 w-full rounded-full bg-white text-[16px] font-bold text-[#2a1458] shadow-md transition active:scale-[.98]"
      >
        {top.late ? 'จ่ายเลย เพื่อหยุดค่าปรับ' : 'จ่ายเลย'}
      </button>

      {pendingLine}
      {actions.length > 1 && <p className="mt-3 text-center text-sm opacity-90">และอีก {actions.length - 1} รายการ ดูด้านล่าง ↓</p>}
    </section>
  )
}
