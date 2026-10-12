// แปลงแถวบันทึกระบบเป็นข้อความอ่านง่าย (ไม่มี UI / ไม่เรียกฐานข้อมูล)
import { fmtBaht, fmtDateTime } from './format'

export type AuditRow = {
  id: number
  actor: string | null
  action: string
  table_name: string
  row_id: string | null
  new_data: Record<string, unknown> | null
  old_data: Record<string, unknown> | null
  at: string
}

export const TABLE_LABEL: Record<string, string> = {
  loans: 'รายการยืม',
  payments: 'การชำระ',
  profiles: 'บัญชี',
  loan_requests: 'คำขอ',
  app_settings: 'ตั้งค่า',
}
export const ACTION_LABEL: Record<string, string> = { insert: 'เพิ่ม', update: 'แก้ไข', delete: 'ลบ' }
export const ACTION_TONE: Record<string, string> = {
  insert: 'bg-emerald-100 text-ok',
  update: 'bg-brand-50 text-brand-700',
  delete: 'bg-red-100 text-danger',
}

/** ชื่อช่องที่อ่านง่าย — ช่องภายใน (เช่น updated_at, reminded_*) ไม่แสดง */
const FIELD_LABEL: Record<string, string> = {
  principal: 'เงินต้น',
  borrowed_on: 'วันที่ยืม',
  interest_start_on: 'เริ่มคิดดอก',
  daily_interest: 'ดอก/วัน',
  due_at: 'วันครบกำหนด',
  hourly_penalty: 'ค่าปรับ',
  penalty_unit: 'หน่วยค่าปรับ',
  interest_mode: 'แบบดอก',
  daily_cutoff: 'ตัดรอบ',
  note: 'หมายเหตุ',
  amount: 'ยอด',
  method: 'วิธีจ่าย',
  paid_at: 'เวลาจ่าย',
  status: 'สถานะ',
  reject_reason: 'เหตุผลไม่ผ่าน',
  aka: 'ชื่อ',
  active: 'ใช้งาน',
  avatar: 'รูปโปรไฟล์',
  cover: 'ธีม cover',
  max_admins: 'จำนวน admin สูงสุด',
  promptpay_id: 'พร้อมเพย์',
  promptpay_name: 'ชื่อบัญชี',
  promptpay_payload: 'QR พร้อมเพย์',
  proposed_due_at: 'ขอเลื่อนเป็น',
  installments: 'จำนวนงวด',
  admin_note: 'หมายเหตุผู้ดูแล',
}
const VALUE_LABEL: Record<string, string> = {
  with_principal: 'พร้อมเงินต้น',
  daily: 'รายวัน',
  cash: 'เงินสด',
  transfer: 'โอน',
  pending: 'รอตรวจ',
  approved: 'อนุมัติ',
  rejected: 'ไม่ผ่าน',
  true: 'ใช่',
  false: 'ไม่',
}
const MONEY_FIELDS = ['amount', 'principal', 'daily_interest', 'hourly_penalty']

export function showValue(k: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '–'
  if (k === 'promptpay_payload') return 'อัปโหลดแล้ว'
  if (k === 'penalty_unit') return v === 'day' ? 'ต่อวัน' : 'ต่อชั่วโมง'
  const str = String(v)
  if (VALUE_LABEL[str]) return VALUE_LABEL[str]
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return fmtDateTime(str)
  if (MONEY_FIELDS.includes(k) && Number.isFinite(Number(v))) return fmtBaht(Number(v))
  return str.length > 40 ? `${str.slice(0, 40)}…` : str
}

/** สรุปสั้น ๆ ว่าแถวนี้มีอะไร หรือเปลี่ยนอะไร */
export function auditDetail(r: AuditRow): string[] {
  if (r.action === 'update' && r.old_data && r.new_data) {
    return Object.keys(r.new_data)
      .filter((k) => FIELD_LABEL[k] && JSON.stringify(r.new_data![k]) !== JSON.stringify(r.old_data![k]))
      .map((k) => `${FIELD_LABEL[k]}: ${showValue(k, r.old_data![k])} → ${showValue(k, r.new_data![k])}`)
  }
  const d = r.new_data ?? r.old_data ?? {}
  const keys: Record<string, string[]> = {
    payments: ['amount', 'method', 'status', 'note'],
    loans: ['principal', 'interest_mode', 'due_at'],
    profiles: ['aka'],
    loan_requests: ['proposed_due_at', 'installments', 'status'],
  }
  return (keys[r.table_name] ?? [])
    .filter((k) => d[k] !== null && d[k] !== undefined && d[k] !== '')
    .map((k) => `${FIELD_LABEL[k]}: ${showValue(k, d[k])}`)
}
