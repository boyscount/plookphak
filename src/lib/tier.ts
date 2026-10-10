// ระดับบัตรและเหรียญรางวัลของผู้ยืม คำนวณจากประวัติการจ่าย
import { dailyHistory, loanSnapshot, type LoanTerms, type PaymentLike } from './loanMath'

export type Tier = 'platinum' | 'gold' | 'silver'

type LoanLike = LoanTerms & { payments: PaymentLike[] }

export function memberStats(loans: LoanLike[], nowMs: number) {
  let lateHours = 0
  let overdueNow = false
  let closed = 0
  let earlyClose = false
  let penaltyCleared = false
  let bestStreak = 0
  let paidCount = 0

  for (const l of loans) {
    const s = loanSnapshot(l, l.payments, nowMs)
    lateHours += s.hours
    if (s.state === 'overdue') overdueNow = true
    if (s.state === 'paid') {
      closed++
      if (s.settledAt !== null && s.settledAt < Date.parse(l.due_at)) earlyClose = true
      if (s.penalty > 0) penaltyCleared = true
    }
    paidCount += l.payments.filter((p) => p.status !== 'rejected').length
    if (l.interest_mode === 'daily') {
      let run = 0
      for (const d of dailyHistory(l, l.payments, nowMs, 60)) {
        if (d.status === 'on_time') bestStreak = Math.max(bestStreak, ++run)
        else if (d.status !== 'today' && d.status !== 'none') run = 0
      }
    }
  }
  return { lateHours, overdueNow, closed, earlyClose, penaltyCleared, bestStreak, paidCount }
}

export type MemberStats = ReturnType<typeof memberStats>

/** Platinum: ไม่เคยโดนปรับเลยและมีประวัติจ่ายแล้ว · Silver: กำลังค้าง หรือโดนปรับรวมเกิน 24 ชม. · ที่เหลือ Gold */
export function tierOf(s: MemberStats): Tier {
  if (s.overdueNow || s.lateHours > 24) return 'silver'
  if (s.lateHours === 0 && (s.paidCount >= 3 || s.closed >= 1)) return 'platinum'
  return 'gold'
}

export const TIER_LABEL: Record<Tier, string> = {
  platinum: 'PLATINUM',
  gold: 'GOLD',
  silver: 'SILVER',
}

export function badges(s: MemberStats) {
  return [
    { id: 'first', icon: '💸', label: 'จ่ายครั้งแรก', hint: 'ส่งสลิปหรือจ่ายเงินครั้งแรก', earned: s.paidCount >= 1 },
    { id: 'streak', icon: '🔥', label: 'จ่ายทัน 7 วันติด', hint: 'จ่ายดอกรายวันทันติดกัน 7 วัน', earned: s.bestStreak >= 7 },
    { id: 'angel', icon: '😇', label: 'ไม่เคยโดนปรับ', hint: 'จ่ายแล้วและไม่เคยโดนค่าปรับ', earned: s.paidCount >= 1 && s.lateHours === 0 },
    { id: 'early', icon: '🏆', label: 'ปิดยอดก่อนกำหนด', hint: 'จ่ายครบก่อนวันครบกำหนด', earned: s.earlyClose },
    { id: 'closer', icon: '✅', label: 'ปิดยอดครบ', hint: 'ปิดยอดได้อย่างน้อย 1 รายการ', earned: s.closed >= 1 },
    { id: 'comeback', icon: '💪', label: 'เคลียร์ค่าปรับ', hint: 'เคยโดนปรับแต่จ่ายครบแล้ว', earned: s.penaltyCleared },
  ]
}
