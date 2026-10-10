// อ่าน QR จากรูป (ทำในเครื่อง ไม่ได้อัปโหลดรูปไปไหน) — โหลด jsQR เฉพาะตอนใช้
export async function decodeQrImage(file: File): Promise<string | null> {
  const { default: jsQR } = await import('jsqr')
  const bmp = await createImageBitmap(file)
  // ลองหลายขนาด เผื่อรูปใหญ่/เล็กเกิน หรือ QR มีโลโก้ตรงกลาง
  for (const target of [1000, 700, 1400, 500]) {
    const scale = Math.min(1, target / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    const img = ctx.getImageData(0, 0, w, h)
    const hit = jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' })
    if (hit?.data) return hit.data
  }
  return null
}
