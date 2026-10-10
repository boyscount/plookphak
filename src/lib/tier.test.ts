import { describe, expect, it } from 'vitest'
import { badges, memberStats, tierOf } from './tier'

const t = (s: string) => Date.parse(s)
const pay = (amount: number, at: string) => ({ amount, paid_at: new Date(t(at)).toISOString(), status: 'approved' as const })

const base = {
  principal: 1000,
  interest_start_on: '2026-10-01',
  daily_interest: 50,
  due_at: '2026-10-10T18:00:00+07:00',
  hourly_penalty: 20,
}

describe('ระดับบัตร', () => {
  it('ยังไม่มีประวัติ = Gold', () => {
    const s = memberStats([{ ...base, payments: [] }], t('2026-10-02T09:00:00+07:00'))
    expect(tierOf(s)).toBe('gold')
  })

  it('ปิดยอดก่อนกำหนดไม่เคยโดนปรับ = Platinum + เหรียญ', () => {
    const s = memberStats([{ ...base, payments: [pay(1100, '2026-10-02T09:00:00+07:00')] }], t('2026-10-20T00:00:00+07:00'))
    expect(tierOf(s)).toBe('platinum')
    const earned = badges(s).filter((b) => b.earned).map((b) => b.id)
    expect(earned).toEqual(['first', 'angel', 'early', 'closer'])
  })

  it('กำลังค้างเกินชั่วโมง = Silver', () => {
    const s = memberStats([{ ...base, payments: [] }], t('2026-10-10T20:00:00+07:00'))
    expect(tierOf(s)).toBe('silver')
  })

  it('จ่ายดอกรายวันทันติดกัน 7 วัน ได้เหรียญ 🔥', () => {
    const payments = Array.from({ length: 7 }, (_, i) => pay(50, `2026-10-0${i + 1}T12:00:00+07:00`))
    const s = memberStats([{ ...base, interest_mode: 'daily', daily_cutoff: '17:00', payments }], t('2026-10-08T09:00:00+07:00'))
    expect(s.bestStreak).toBe(7)
    expect(badges(s).find((b) => b.id === 'streak')!.earned).toBe(true)
  })
})
