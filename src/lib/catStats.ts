// ค่าพลังแมวในบ้านแมว คำนวณจากยอดยืมจริง
//   อิ่ม     = ดอก/ยอดที่ถึงรอบแล้วยังไม่จ่าย (จ่ายแล้ว = อิ่ม)
//   ความสุข  = จ่ายตรงเวลาไหม (ค้างนาน = เศร้าลง)
//   สุขภาพ   = ระดับบัตร Platinum / Gold / Silver
import { loanSnapshot, type LoanTerms, type PaymentLike } from './loanMath'
import { memberStats, tierOf, type Tier } from './tier'

type LoanLike = LoanTerms & { payments: PaymentLike[] }

export type CatMood = 'happy' | 'ok' | 'hungry' | 'sad'

const HOUR = 3_600_000
const clamp = (v: number) => Math.round(Math.max(0, Math.min(100, v)))

export function catStats(loans: LoanLike[], nowMs: number) {
  const tier: Tier = tierOf(memberStats(loans, nowMs))
  const health = { platinum: 100, gold: 80, silver: 50 }[tier]

  // ใช้รายการที่แย่ที่สุดที่ยังเปิดอยู่เป็นตัวกำหนด
  let fullness = 100
  let happiness = { platinum: 100, gold: 88, silver: 65 }[tier]
  let lateHours = 0
  let owedNow = 0
  let nextDueAt: number | null = null

  for (const l of loans) {
    const s = loanSnapshot(l, l.payments, nowMs)
    if (s.state === 'paid' || s.state === 'pending_review') continue
    if (s.lateSince !== null) {
      const h = (nowMs - s.lateSince) / HOUR
      lateHours = Math.max(lateHours, h)
      fullness = Math.min(fullness, 40 - h * 3)
      happiness = Math.min(happiness, s.state === 'grace' ? 60 : 55 - h * 2)
      owedNow += s.daily ? s.arrearsAmount : s.balance
    } else {
      const due = s.daily ? (s.nextDue?.at ?? null) : Date.parse(l.due_at)
      if (due !== null) {
        nextDueAt = nextDueAt === null ? due : Math.min(nextDueAt, due)
        const left = (due - nowMs) / HOUR
        // ใกล้ถึงรอบ = เริ่มหิว
        fullness = Math.min(fullness, left < 3 ? 55 : left < 24 ? 75 : 95)
      }
    }
  }

  fullness = clamp(fullness)
  happiness = clamp(happiness)
  const mood: CatMood =
    lateHours >= 1 && happiness < 40 ? 'sad' : fullness < 60 ? 'hungry' : happiness >= 80 ? 'happy' : 'ok'

  return { tier, health, fullness, happiness, mood, lateHours, owedNow, nextDueAt }
}

export type CatStats = ReturnType<typeof catStats>

export function catLine(s: CatStats, name: string) {
  switch (s.mood) {
    case 'sad':
      return `${name} ลืมแมวแล้วเหรอ… ค้างมา ${Math.floor(s.lateHours)} ชม. แล้วนะ 😿`
    case 'hungry':
      return 'หิวแล้วอ่ะ อัปสลิปให้อาหารหน่อยน้า 🥺🍗'
    case 'happy':
      return 'ขอบคุณที่จ่ายตรงเวลา รักเลย 💕'
    default:
      return 'วันนี้ก็ชิลล์ ๆ ไปก่อน 😺'
  }
}
