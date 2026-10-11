import { describe, expect, it } from 'vitest'
import { auditDetail, type AuditRow } from './auditFormat'

const row = (r: Partial<AuditRow>): AuditRow => ({
  id: 1,
  actor: null,
  action: 'insert',
  table_name: 'payments',
  row_id: 'x',
  new_data: null,
  old_data: null,
  at: '2026-10-10T10:00:00Z',
  ...r,
})

describe('บันทึกระบบอ่านง่าย', () => {
  it('แก้ไข: แสดงเฉพาะช่องที่เปลี่ยน เป็นชื่อไทย ไม่โชว์ช่องภายใน', () => {
    const d = auditDetail(
      row({
        action: 'update',
        table_name: 'payments',
        old_data: { status: 'pending', amount: 90, updated_at: 'a', reviewed_by: 'u1' },
        new_data: { status: 'approved', amount: 90, updated_at: 'b', reviewed_by: 'u2' },
      }),
    )
    expect(d).toEqual(['สถานะ: รอตรวจ → อนุมัติ'])
  })

  it('เพิ่มการชำระ: สรุปยอด วิธี สถานะ หมายเหตุ', () => {
    const d = auditDetail(row({ new_data: { amount: 120, method: 'cash', status: 'approved', note: 'ดอกวันที่ 8–11 ต.ค.' } }))
    expect(d[0]).toMatch(/^ยอด: 120/)
    expect(d.slice(1)).toEqual(['วิธีจ่าย: เงินสด', 'สถานะ: อนุมัติ', 'หมายเหตุ: ดอกวันที่ 8–11 ต.ค.'])
  })

  it('ลบรายการยืม: ใช้ข้อมูลเก่า แปลงแบบดอกเป็นภาษาไทย', () => {
    const d = auditDetail(row({ action: 'delete', table_name: 'loans', old_data: { principal: 1500, interest_mode: 'daily' } }))
    expect(d).toContain('แบบดอก: รายวัน')
  })

  it('QR พร้อมเพย์ไม่โชว์ข้อมูลดิบ', () => {
    const d = auditDetail(
      row({ action: 'update', table_name: 'app_settings', old_data: { promptpay_payload: null }, new_data: { promptpay_payload: '000201...' } }),
    )
    expect(d).toEqual(['QR พร้อมเพย์: – → อัปโหลดแล้ว'])
  })
})
