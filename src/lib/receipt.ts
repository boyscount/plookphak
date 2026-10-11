// วาดใบเสร็จเป็นรูป PNG (ทำในเครื่อง) สำหรับบันทึกหรือแชร์ลง LINE
import { fmtBaht, fmtDate, fmtDateTime } from './format'
import { loanSnapshot } from './loanMath'
import type { Loan, Payment } from './types'

export type ReceiptData = {
  no: string
  name: string
  amount: number
  paidAt: string
  method: Payment['method']
  note: string | null
  principal: number
  borrowedOn: string
  mode: Loan['interest_mode']
  /** ยอดคงเหลือหลังการชำระครั้งนี้ */
  balanceAfter: number
}

/** ยอดคงเหลือ ณ เวลาที่จ่าย นับเฉพาะรายการที่ผ่านแล้วจนถึงครั้งนี้ */
export function receiptData(loan: Loan, payment: Payment): ReceiptData {
  const at = Date.parse(payment.paid_at)
  const upTo = loan.payments.filter((p) => p.status === 'approved' && Date.parse(p.paid_at) <= at)
  return {
    no: payment.id.replace(/-/g, '').slice(0, 10).toUpperCase(),
    name: loan.borrower?.aka ?? '',
    amount: Number(payment.amount),
    paidAt: payment.paid_at,
    method: payment.method,
    note: payment.note,
    principal: Number(loan.principal),
    borrowedOn: loan.borrowed_on,
    mode: loan.interest_mode,
    balanceAfter: loanSnapshot(loan, upTo, at).balance,
  }
}

const W = 1080
const H = 1440
const DISPLAY = "'Prompt', 'IBM Plex Sans Thai', sans-serif"
const BODY = "'IBM Plex Sans Thai', 'Prompt', sans-serif"

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

export async function drawReceipt(d: ReceiptData): Promise<Blob> {
  await Promise.all([
    document.fonts.load(`700 120px ${DISPLAY}`),
    document.fonts.load(`500 40px ${BODY}`),
    document.fonts.load(`700 40px ${BODY}`),
  ]).catch(() => {})

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!

  // พื้นหลัง
  ctx.fillStyle = '#efe9fb'
  ctx.fillRect(0, 0, W, H)

  // การ์ดกระดาษ
  const X = 70
  const Y = 70
  const CW = W - 140
  const CH = H - 140
  ctx.save()
  ctx.shadowColor = 'rgba(42,18,82,.18)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 20
  roundRect(ctx, X, Y, CW, CH, 48)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()

  // หัวม่วง
  ctx.save()
  roundRect(ctx, X, Y, CW, 400, 48)
  ctx.clip()
  const g = ctx.createLinearGradient(X, Y, X + CW, Y + 400)
  g.addColorStop(0, '#4b22a8')
  g.addColorStop(0.6, '#6a32e0')
  g.addColorStop(1, '#9a5cff')
  ctx.fillStyle = g
  ctx.fillRect(X, Y, CW, 420)
  ctx.fillStyle = 'rgba(255,255,255,.08)'
  ctx.beginPath()
  ctx.arc(X + CW - 60, Y + 40, 180, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const L = X + 70
  const R = X + CW - 70
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 46px ${DISPLAY}`
  ctx.fillText('Plookphak', L, Y + 110)
  ctx.font = `500 34px ${BODY}`
  ctx.globalAlpha = 0.85
  ctx.fillText('ใบเสร็จรับเงิน', L, Y + 165)
  ctx.textAlign = 'right'
  ctx.fillText(`เลขที่ ${d.no}`, R, Y + 110)
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
  // ยอดใหญ่ แต่ไม่ทับตราประทับด้านขวา
  let size = 120
  ctx.font = `700 ${size}px ${DISPLAY}`
  while (ctx.measureText(fmtBaht(d.amount)).width > R - L - 330 && size > 60) ctx.font = `700 ${(size -= 6)}px ${DISPLAY}`
  ctx.fillText(fmtBaht(d.amount), L, Y + 330)

  // ตราประทับ "ชำระแล้ว"
  ctx.save()
  ctx.translate(R - 140, Y + 300)
  ctx.rotate(-0.14)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 7
  roundRect(ctx, -140, -60, 280, 120, 24)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 52px ${DISPLAY}`
  ctx.textAlign = 'center'
  ctx.fillText('ชำระแล้ว ✓', 0, 18)
  ctx.restore()

  // รายละเอียด
  const rows: [string, string][] = [
    ['ผู้ชำระ', d.name],
    ['วันเวลาที่ชำระ', fmtDateTime(d.paidAt)],
    ['ช่องทาง', d.method === 'cash' ? 'เงินสด' : 'โอนเงิน'],
    ['รายการยืม', `${fmtBaht(d.principal)} · ${fmtDate(d.borrowedOn)}`],
    ['แบบจ่ายดอก', d.mode === 'daily' ? 'ดอกรายวัน' : 'พร้อมเงินต้น'],
  ]
  if (d.note) rows.push(['หมายเหตุ', d.note])
  let y = Y + 500
  ctx.textAlign = 'left'
  for (const [k, v] of rows) {
    ctx.fillStyle = '#5d5d68'
    ctx.font = `500 34px ${BODY}`
    ctx.fillText(k, L, y)
    ctx.fillStyle = '#0e0e10'
    ctx.font = `600 38px ${BODY}`
    let text = v
    while (ctx.measureText(text).width > R - L - 280 && text.length > 4) text = `${text.slice(0, -2)}…`
    ctx.textAlign = 'right'
    ctx.fillText(text, R, y)
    ctx.textAlign = 'left'
    y += 84
  }

  // เส้นประฉีก
  y += 10
  ctx.strokeStyle = '#d8d2e6'
  ctx.lineWidth = 4
  ctx.setLineDash([16, 14])
  ctx.beginPath()
  ctx.moveTo(L, y)
  ctx.lineTo(R, y)
  ctx.stroke()
  ctx.setLineDash([])

  // ยอดคงเหลือ
  y += 100
  ctx.fillStyle = '#5d5d68'
  ctx.font = `500 36px ${BODY}`
  ctx.fillText('ยอดคงเหลือหลังชำระครั้งนี้', L, y)
  ctx.textAlign = 'right'
  ctx.fillStyle = d.balanceAfter > 0 ? '#5f24c7' : '#0b8457'
  ctx.font = `700 64px ${DISPLAY}`
  ctx.fillText(d.balanceAfter > 0 ? fmtBaht(d.balanceAfter) : 'ปิดยอดแล้ว 🌸', R, y + 10)
  ctx.textAlign = 'left'

  // ท้ายใบ
  ctx.fillStyle = '#8a8696'
  ctx.font = `500 28px ${BODY}`
  ctx.textAlign = 'center'
  ctx.fillText('ตรวจและยืนยันโดยผู้ดูแล · ออกจากระบบ Plookphak', W / 2, Y + CH - 60)

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('สร้างรูปไม่สำเร็จ'))), 'image/png'))
}
