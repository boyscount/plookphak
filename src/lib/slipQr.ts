// แยกประเภท QR ที่อ่านได้จากรูปที่ผู้ยืมเลือก
// - สลิปธนาคารไทยมี mini QR สำหรับตรวจสอบ (มีเลขอ้างอิงธุรกรรม) → ใช้กันส่งสลิปเดิมซ้ำ
// - QR พร้อมเพย์ (EMVCo ขึ้นต้น 000201) คือ QR "รับเงิน" ไม่ใช่สลิป → น่าจะเลือกรูปผิด
export type SlipQr = { kind: 'none' } | { kind: 'promptpay' } | { kind: 'slip'; ref: string }

export function classifySlipQr(data: string | null | undefined): SlipQr {
  const text = data?.trim()
  if (!text) return { kind: 'none' }
  if (text.startsWith('000201')) return { kind: 'promptpay' }
  return { kind: 'slip', ref: text.slice(0, 512) }
}
