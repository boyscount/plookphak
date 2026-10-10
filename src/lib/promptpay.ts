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

// ---------------------------------------------------------------------------
// ใช้ QR เดิมของผู้ให้ยืม (อ่านจากรูป) แล้วใส่ยอดเงินเพิ่มเข้าไป
// ---------------------------------------------------------------------------

type Tlv = { id: string; value: string }

function parseTlv(s: string): Tlv[] | null {
  const out: Tlv[] = []
  let i = 0
  while (i < s.length) {
    const id = s.slice(i, i + 2)
    const len = Number(s.slice(i + 2, i + 4))
    if (!/^\d{2}$/.test(id) || !Number.isFinite(len) || i + 4 + len > s.length) return null
    out.push({ id, value: s.slice(i + 4, i + 4 + len) })
    i += 4 + len
  }
  return out
}

/** ตรวจว่าเป็น QR พร้อมเพย์/Thai QR ที่ถูกต้อง และบอกว่าโอนเข้าอะไร */
export function inspectThaiQr(payload: string) {
  const text = payload.trim()
  const fields = parseTlv(text)
  if (!fields) return { ok: false as const, reason: 'อ่าน QR ไม่ได้' }
  const crc = fields.find((f) => f.id === '63')
  if (!crc || crc.value !== crc16(text.slice(0, -4))) return { ok: false as const, reason: 'QR ไม่สมบูรณ์ (ตรวจสอบรหัสไม่ผ่าน)' }
  const acct = fields.find((f) => f.id === '29' || f.id === '30')
  if (!acct || !acct.value.includes('A0000006770101')) return { ok: false as const, reason: 'ไม่ใช่ QR พร้อมเพย์ / Thai QR Payment' }
  const sub = parseTlv(acct.value) ?? []
  const target = sub.find((f) => f.id !== '00')?.value ?? ''
  const kind = acct.id === '30' ? 'ร้านค้า/บิล' : target.startsWith('0066') ? 'เบอร์มือถือ' : target.length === 13 ? 'เลขบัตร' : 'e-Wallet'
  const label = target.startsWith('0066') ? `0${target.slice(4)}` : target
  return { ok: true as const, payload: text, kind, label }
}

/** ใส่ยอดเงินลงใน QR เดิม: เปลี่ยนเป็นแบบใช้ครั้งเดียว (12), ใส่ช่อง 54, คำนวณรหัสตรวจสอบใหม่ */
export function payloadWithAmount(payload: string, amount: number) {
  const fields = parseTlv(payload.trim())
  if (!fields) return payload
  const kept = fields.filter((f) => f.id !== '54' && f.id !== '63').map((f) => (f.id === '01' ? { id: '01', value: '12' } : f))
  const at = kept.findIndex((f) => f.id === '53')
  const amountField = { id: '54', value: amount.toFixed(2) }
  if (at >= 0) kept.splice(at + 1, 0, amountField)
  else kept.splice(kept.findIndex((f) => f.id === '58'), 0, amountField)
  const body = kept.map((f) => tlv(f.id, f.value)).join('') + '6304'
  return body + crc16(body)
}
