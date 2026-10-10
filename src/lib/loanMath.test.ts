import { describe, expect, it } from 'vitest'
import { dailyHistory, loanSnapshot, owedAt, settledAt, type LoanTerms } from './loanMath'

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
    expect(owedAt(loan, [], t('2026-09-30T23:59:59+07:00')).total).toBe(1000)
  })

  it('วันเริ่มคิดดอกนับเป็นวันที่ 1 ตามเวลาไทย', () => {
    // 1 ต.ค. 00:30 ไทย = 30 ก.ย. 17:30 UTC
    expect(owedAt(loan, [], t('2026-10-01T00:30:00+07:00'))).toMatchObject({ days: 1, interest: 50 })
    expect(owedAt(loan, [], t('2026-10-03T12:00:00+07:00'))).toMatchObject({ days: 3, interest: 150 })
  })

  it('เลยกำหนดไม่ถึง 1 ชม. ยังไม่ปรับ', () => {
    expect(owedAt(loan, [], t('2026-10-05T18:59:59+07:00')).penalty).toBe(0)
  })

  it('ปรับทุกชั่วโมงเต็ม และดอกรายวันยังเดินต่อ', () => {
    const o = owedAt(loan, [], t('2026-10-06T09:30:00+07:00'))
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

// แบบจ่ายดอกรายวัน: ดอก 50 ตัดรอบ 17:00, ปรับ 20/ชม., เริ่มคิดดอก 1 ต.ค., คืนต้น 10 ต.ค. 18:00
const daily: LoanTerms = {
  principal: 1000,
  interest_start_on: '2026-10-01',
  daily_interest: 50,
  due_at: '2026-10-10T18:00:00+07:00',
  hourly_penalty: 20,
  interest_mode: 'daily',
  daily_cutoff: '17:00:00',
}
const pay = (amount: number, at: string, status: 'approved' | 'pending' | 'rejected' = 'approved') => ({
  amount,
  paid_at: new Date(t(at)).toISOString(),
  status,
})

describe('แบบจ่ายดอกรายวัน', () => {
  it('ก่อนตัดรอบวันแรก ยังไม่ค้าง และต้องจ่าย 50 ภายใน 17:00', () => {
    const s = loanSnapshot(daily, [], t('2026-10-01T10:00:00+07:00'))
    expect(s).toMatchObject({ state: 'not_due', hours: 0, arrearsAmount: 0 })
    expect(s.nextDue).toEqual({ at: t('2026-10-01T17:00:00+07:00'), amount: 50 })
  })

  it('จ่ายทันทุกวัน ไม่มีค่าปรับ', () => {
    const pays = [pay(50, '2026-10-01T12:00:00+07:00'), pay(50, '2026-10-02T17:00:00+07:00')]
    const s = loanSnapshot(daily, pays, t('2026-10-03T09:00:00+07:00'))
    expect(s).toMatchObject({ state: 'not_due', penalty: 0, interest: 150 })
    expect(s.nextDue).toEqual({ at: t('2026-10-03T17:00:00+07:00'), amount: 50 })
  })

  it('เลย 17:00 ไม่ถึง 1 ชม. ยังไม่ปรับ, ครบ 1 ชม. ปรับ 20', () => {
    expect(loanSnapshot(daily, [], t('2026-10-01T17:59:00+07:00'))).toMatchObject({ state: 'grace', penalty: 0, arrearsAmount: 50 })
    expect(loanSnapshot(daily, [], t('2026-10-01T18:00:00+07:00'))).toMatchObject({ state: 'overdue', penalty: 20 })
  })

  it('ค้างหลายวัน ค่าปรับรวมก้อนเดียว 20/ชม. ไม่ซ้อน', () => {
    // ค้างตั้งแต่ 1 ต.ค. 17:00 ถึง 3 ต.ค. 17:00 = 48 ชม.
    const s = loanSnapshot(daily, [], t('2026-10-03T17:00:00+07:00'))
    expect(s).toMatchObject({ hours: 48, penalty: 960, arrearsAmount: 150 })
  })

  it('อัปสลิปจ่ายดอกที่ค้าง ค่าปรับหยุด (แม้รอตรวจ) ค่าปรับที่เกิดแล้วยังอยู่', () => {
    const pays = [pay(50, '2026-10-01T20:30:00+07:00', 'pending')]
    const s = loanSnapshot(daily, pays, t('2026-10-02T10:00:00+07:00'))
    expect(s).toMatchObject({ state: 'not_due', hours: 3, penalty: 60, arrearsAmount: 0 })
  })

  it('สลิปถูกปฏิเสธ ค่าปรับเดินต่อย้อนหลัง', () => {
    const pays = [pay(50, '2026-10-01T20:30:00+07:00', 'rejected')]
    expect(loanSnapshot(daily, pays, t('2026-10-02T10:00:00+07:00'))).toMatchObject({ state: 'overdue', hours: 17 })
  })

  it('เลยวันคืนเงินต้น ค่าปรับเดินจนกว่าจะคืนครบ แล้วนาฬิกาหยุด', () => {
    const pays = Array.from({ length: 10 }, (_, i) => pay(50, `2026-10-${String(i + 1).padStart(2, '0')}T12:00:00+07:00`))
    // 10 ต.ค. 18:00 ครบคืนต้น → 20:00 = ค้าง 2 ชม.
    const s = loanSnapshot(daily, pays, t('2026-10-10T20:00:00+07:00'))
    expect(s).toMatchObject({ state: 'overdue', hours: 2, interest: 500, balance: 1040 })
    const done = [...pays, pay(1040, '2026-10-10T20:00:00+07:00')]
    const after = loanSnapshot(daily, done, t('2026-10-12T00:00:00+07:00'))
    expect(after).toMatchObject({ state: 'paid', balance: 0, penalty: 40 })
  })

  it('ปิดยอดก่อนกำหนด ดอกหยุดที่วันที่จ่าย', () => {
    const pays = [pay(50, '2026-10-01T12:00:00+07:00'), pay(1050, '2026-10-02T09:00:00+07:00')]
    expect(loanSnapshot(daily, pays, t('2026-10-09T00:00:00+07:00'))).toMatchObject({ state: 'paid', interest: 100, balance: 0 })
  })
})

describe('ข้อมูลกราฟ', () => {
  it('ประวัติดอกรายวัน: ทัน / ช้า / ไม่จ่าย / วันนี้', () => {
    const pays = [pay(50, '2026-10-01T12:00:00+07:00'), pay(50, '2026-10-02T20:00:00+07:00')]
    const h = dailyHistory(daily, pays, t('2026-10-04T10:00:00+07:00'), 5)
    expect(h.map((x) => x.status)).toEqual(['none', 'on_time', 'late', 'missed', 'today'])
  })
})
