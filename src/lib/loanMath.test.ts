import { describe, expect, it } from 'vitest'
import { loanSnapshot, owedAt, settledAt, type LoanTerms } from './loanMath'

// ยืม 1,000 ดอก 50/วัน เริ่มคิดดอก 1 ต.ค. ครบชำระ 5 ต.ค. 18:00 (ไทย) ปรับ 20/ชม.
const loan: LoanTerms = {
  principal: 1000,
  interest_start_on: '2026-10-01',
  daily_interest: 50,
  due_at: '2026-10-05T18:00:00+07:00',
  hourly_penalty: 20,
}
const t = (s: string) => Date.parse(s)

describe('owedAt', () => {
  it('ยังไม่ถึงวันเริ่มคิดดอก ไม่มีดอก', () => {
    expect(owedAt(loan, t('2026-09-30T23:59:59+07:00')).total).toBe(1000)
  })

  it('วันเริ่มคิดดอกนับเป็นวันที่ 1 ตามเวลาไทย', () => {
    // 1 ต.ค. 00:30 ไทย = 30 ก.ย. 17:30 UTC
    expect(owedAt(loan, t('2026-10-01T00:30:00+07:00'))).toMatchObject({ days: 1, interest: 50 })
    expect(owedAt(loan, t('2026-10-03T12:00:00+07:00'))).toMatchObject({ days: 3, interest: 150 })
  })

  it('เลยกำหนดไม่ถึง 1 ชม. ยังไม่ปรับ', () => {
    expect(owedAt(loan, t('2026-10-05T18:59:59+07:00')).penalty).toBe(0)
  })

  it('ปรับทุกชั่วโมงเต็ม และดอกรายวันยังเดินต่อ', () => {
    const o = owedAt(loan, t('2026-10-06T09:30:00+07:00'))
    expect(o).toMatchObject({ days: 6, interest: 300, hours: 15, penalty: 300, total: 1600 })
  })
})

describe('settledAt', () => {
  it('จ่ายบางส่วนยังไม่หยุดนาฬิกา', () => {
    const pays = [{ amount: 500, paid_at: '2026-10-02T10:00:00+07:00', status: 'approved' as const }]
    expect(settledAt(loan, pays)).toBeNull()
  })

  it('หยุดที่เวลาอัปโหลดสลิปที่ทำให้ครบ แม้ยังรอตรวจ', () => {
    const pays = [
      { amount: 500, paid_at: '2026-10-02T10:00:00+07:00', status: 'approved' as const },
      // ณ 6 ต.ค. 09:30 ต้องจ่าย 1,600 → 500 + 1,100 = ครบพอดี
      { amount: 1100, paid_at: '2026-10-06T09:30:00+07:00', status: 'pending' as const },
    ]
    expect(settledAt(loan, pays)).toBe(t('2026-10-06T09:30:00+07:00'))
    const snap = loanSnapshot(loan, pays, t('2026-10-08T00:00:00+07:00'))
    expect(snap).toMatchObject({ state: 'pending_review', total: 1600, balance: 0 })
  })

  it('สลิปถูกปฏิเสธ นาฬิกาเดินต่อย้อนหลัง', () => {
    const pays = [{ amount: 1600, paid_at: '2026-10-06T09:30:00+07:00', status: 'rejected' as const }]
    const snap = loanSnapshot(loan, pays, t('2026-10-06T11:30:00+07:00'))
    expect(snap).toMatchObject({ state: 'overdue', hours: 17, balance: 1640 })
  })

  it('จ่ายไม่พอ ณ เวลาที่ส่ง ไม่ถือว่าครบ', () => {
    const pays = [{ amount: 1500, paid_at: '2026-10-06T09:30:00+07:00', status: 'approved' as const }]
    expect(settledAt(loan, pays)).toBeNull()
  })
})

describe('loanSnapshot state', () => {
  it('ช่วง 1 ชม. แรกหลังครบกำหนดเป็น grace', () => {
    expect(loanSnapshot(loan, [], t('2026-10-05T18:10:00+07:00')).state).toBe('grace')
    expect(loanSnapshot(loan, [], t('2026-10-05T19:00:00+07:00')).state).toBe('overdue')
  })

  it('นับเวลาถึงการปรับครั้งถัดไป', () => {
    const s = loanSnapshot(loan, [], t('2026-10-05T19:15:00+07:00'))
    expect(s.msToNextPenalty).toBe(45 * 60_000)
  })
})
