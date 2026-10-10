import { describe, expect, it } from 'vitest'
import { inspectThaiQr, isValidPromptPayId, payloadWithAmount, promptPayPayload } from './promptpay'

describe('QR พร้อมเพย์', () => {
  // ตัวอย่างจาก README ของ promptpay-qr (dtinth) ที่ใช้กันแพร่หลาย
  it('เบอร์โทร + ยอดเงิน ตรงกับตัวอย่างมาตรฐาน', () => {
    expect(promptPayPayload('000-000-0000', 4.22)).toBe(
      '00020101021229370016A000000677010111011300660000000005802TH530376454044.226304E469',
    )
  })

  it('ไม่ใส่ยอด = QR แบบสแตติก', () => {
    expect(promptPayPayload('0812345678')).toMatch(/^000201010211/)
  })

  it('เลขบัตรประชาชน 13 หลักใช้ช่อง 02', () => {
    expect(promptPayPayload('1234567890123', 50)).toContain('02131234567890123')
  })

  it('ตรวจรูปแบบเลขพร้อมเพย์', () => {
    expect(isValidPromptPayId('081-234-5678')).toBe(true)
    expect(isValidPromptPayId('1234567890123')).toBe(true)
    expect(isValidPromptPayId('12345')).toBe(false)
  })
})

describe('ใช้ QR เดิมของผู้ให้ยืม', () => {
  const staticQr = promptPayPayload('000-000-0000')

  it('อ่าน QR พร้อมเพย์จากเบอร์ได้', () => {
    expect(inspectThaiQr(staticQr)).toMatchObject({ ok: true, kind: 'เบอร์มือถือ', label: '0000000000' })
  })

  it('ใส่ยอดลง QR เดิมแล้วได้ผลเหมือนตัวอย่างมาตรฐาน', () => {
    expect(payloadWithAmount(staticQr, 4.22)).toBe(
      '00020101021229370016A000000677010111011300660000000005802TH530376454044.226304E469',
    )
  })

  it('QR ที่รหัสตรวจสอบผิด หรือไม่ใช่พร้อมเพย์ จะไม่ผ่าน', () => {
    expect(inspectThaiQr(staticQr.slice(0, -1) + '0').ok).toBe(false)
    expect(inspectThaiQr('https://example.com').ok).toBe(false)
  })
})
