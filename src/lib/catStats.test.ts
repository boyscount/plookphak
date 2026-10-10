import { describe, expect, it } from 'vitest'
import { catStats } from './catStats'

const t = (s: string) => Date.parse(s)
const pay = (amount: number, at: string) => ({ amount, paid_at: new Date(t(at)).toISOString(), status: 'approved' as const })

const daily = {
  principal: 1000,
  interest_start_on: '2026-10-01',
  daily_interest: 50,
  due_at: '2026-10-20T18:00:00+07:00',
  hourly_penalty: 20,
  interest_mode: 'daily' as const,
  daily_cutoff: '17:00',
}

describe('ค่าพลังแมว', () => {
  it('จ่ายทันและอีกนานกว่าจะถึงรอบ = อิ่ม มีความสุข', () => {
    const s = catStats([{ ...daily, payments: [pay(50, '2026-10-01T09:00:00+07:00')] }], t('2026-10-01T18:00:00+07:00'))
    expect(s).toMatchObject({ mood: 'happy', fullness: 75 })
  })

  it('ใกล้ตัดรอบ = เริ่มหิว', () => {
    const s = catStats([{ ...daily, payments: [] }], t('2026-10-01T15:00:00+07:00'))
    expect(s).toMatchObject({ fullness: 55, mood: 'hungry' })
  })

  it('ค้างหลายชั่วโมง = หิวมากและเศร้า', () => {
    const s = catStats([{ ...daily, payments: [] }], t('2026-10-02T03:00:00+07:00'))
    expect(s.fullness).toBe(10)
    expect(s.mood).toBe('sad')
    expect(s.owedNow).toBe(50)
  })

  it('ไม่มีรายการเปิดอยู่ = อิ่มเต็ม', () => {
    expect(catStats([], t('2026-10-02T03:00:00+07:00'))).toMatchObject({ fullness: 100, mood: 'happy' })
  })
})
