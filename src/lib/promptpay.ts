// สร้างข้อความ QR พร้อมเพย์ (มาตรฐาน EMVCo / Thai QR Payment) ใส่ยอดเงินได้
// รองรับ: เบอร์มือถือ 10 หลัก, เลขบัตรประชาชน/เลขผู้เสียภาษี 13 หลัก, e-Wallet 15 หลัก

function tlv(id: string, value: string) {
  return id + String(value.length).padStart(2, '0') + value
}

/** CRC16-CCITT (poly 0x1021, เริ่ม 0xFFFF) ตามที่มาตรฐานกำหนด */
function crc16(s: string) {
  let crc = 0xffff
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    crc &= 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function normalizePromptPayId(raw: string) {
  return raw.replace(/\D/g, '')
}

export function isValidPromptPayId(raw: string) {
  const id = normalizePromptPayId(raw)
  return /^0\d{9}$/.test(id) || /^\d{13}$/.test(id) || /^\d{15}$/.test(id)
}

export function promptPayPayload(rawId: string, amount?: number) {
  const id = normalizePromptPayId(rawId)
  let target: string
  if (id.length >= 15) target = tlv('03', id)
  else if (id.length >= 13) target = tlv('02', id)
  else target = tlv('01', ('0000000000000' + id.replace(/^0/, '66')).slice(-13))

  const hasAmount = amount !== undefined && amount > 0
  const body =
    tlv('00', '01') +
    tlv('01', hasAmount ? '12' : '11') +
    tlv('29', tlv('00', 'A000000677010111') + target) +
    tlv('58', 'TH') +
    tlv('53', '764') +
    (hasAmount ? tlv('54', amount!.toFixed(2)) : '') +
    '6304'
  return body + crc16(body)
}
