// ฝน + วงน้ำกระเพื่อม + ฟ้าแลบ วาดบน canvas ทับฉาก login ตามอากาศจริง
// - ความหนาฝนตามปริมาณฝน, ความเอียงตามความเร็วลม
// - ฟ้าแลบเฉพาะตอนพายุฝนฟ้าคะนอง (รหัส 95–99) — ปิดเองถ้าเครื่องตั้ง "ลดการเคลื่อนไหว" (กันคนแพ้แสงวาบ)
import { useEffect, useRef } from 'react'

type Drop = { x: number; y: number; len: number; v: number }
type Ripple = { x: number; y: number; r: number; life: number }

export function WeatherFx({
  rain,
  wind,
  lightning,
  night,
  lakeTop = 0.66,
  demo = false,
}: {
  /** 0..1 */
  rain: number
  /** กม./ชม. */
  wind: number
  lightning: boolean
  night: boolean
  /** ขอบบนของทะเลสาบ (สัดส่วนความสูง) — ใต้เส้นนี้มีวงน้ำกระเพื่อม */
  lakeTop?: number
  /** ฟ้าแลบถี่ขึ้น (ใช้ตอนกดดูตัวอย่าง) */
  demo?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || (rain <= 0 && !lightning)) return
    const ctx = canvas.getContext('2d')!
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let dpr = 1
    const fit = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)

    // ลมพัดฝนเอียง: 0 กม./ชม. = ตรง, 40+ = เอียงมาก
    const slant = Math.min(0.55, wind / 70)
    const count = Math.round((30 + rain * 260) * Math.max(0.6, w / 420))
    const drops: Drop[] = Array.from({ length: count }, () => spawn(true))
    const ripples: Ripple[] = []
    function spawn(anywhere = false): Drop {
      const len = 8 + Math.random() * 14 * (0.6 + rain)
      return {
        x: Math.random() * (w + h * slant) - h * slant,
        y: anywhere ? Math.random() * h : -len - Math.random() * 40,
        len,
        v: 9 + Math.random() * 7 + rain * 6,
      }
    }

    let flash = 0 // ความสว่างแสงวาบ 0..1
    let bolt: { pts: [number, number][]; life: number } | null = null
    let nextStrike = performance.now() + (demo ? 900 : 2500 + Math.random() * 5000)
    const strike = (t: number) => {
      flash = 0.85
      // แลบซ้ำสั้น ๆ อีกครั้งเหมือนฟ้าจริง
      setTimeout(() => (flash = Math.max(flash, 0.55)), 140)
      if (Math.random() < 0.6) {
        const pts: [number, number][] = []
        let x = w * (0.15 + Math.random() * 0.7)
        let y = 0
        const end = h * (0.38 + Math.random() * 0.2)
        while (y < end) {
          pts.push([x, y])
          x += (Math.random() - 0.5) * 34
          y += 10 + Math.random() * 22
        }
        pts.push([x, end])
        bolt = { pts, life: 1 }
      }
      nextStrike = t + (demo ? 2200 + Math.random() * 2500 : 4000 + Math.random() * 8000)
    }

    const color = night ? 'rgba(190,205,255,' : 'rgba(255,255,255,'
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)

      // ฝน
      if (rain > 0) {
        ctx.lineCap = 'round'
        ctx.lineWidth = 1.1
        ctx.strokeStyle = `${color}${0.25 + rain * 0.3})`
        ctx.beginPath()
        for (const d of drops) {
          ctx.moveTo(d.x, d.y)
          ctx.lineTo(d.x + d.len * slant, d.y + d.len)
          if (!reduce) {
            d.y += d.v
            d.x += d.v * slant
            // ตกถึงผิวน้ำ → วงกระเพื่อม
            if (d.y > h * lakeTop && Math.random() < 0.06 + rain * 0.05 && ripples.length < 60) {
              ripples.push({ x: d.x, y: d.y, r: 1, life: 1 })
              Object.assign(d, spawn())
            } else if (d.y > h) Object.assign(d, spawn())
          }
        }
        ctx.stroke()

        ctx.lineWidth = 1
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i]
          ctx.strokeStyle = `${color}${r.life * 0.45})`
          ctx.beginPath()
          ctx.ellipse(r.x, r.y, r.r * 2.2, r.r * 0.7, 0, 0, Math.PI * 2)
          ctx.stroke()
          r.r += 0.35
          r.life -= 0.035
          if (r.life <= 0) ripples.splice(i, 1)
        }
      }

      // ฟ้าแลบ
      if (lightning && !reduce) {
        if (t >= nextStrike) strike(t)
        if (bolt) {
          ctx.save()
          ctx.strokeStyle = `rgba(255,255,255,${bolt.life})`
          ctx.shadowColor = 'rgba(190,200,255,.95)'
          ctx.shadowBlur = 18
          ctx.lineWidth = 2.4
          ctx.lineJoin = 'round'
          ctx.beginPath()
          bolt.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
          ctx.stroke()
          ctx.restore()
          bolt.life -= 0.06
          if (bolt.life <= 0) bolt = null
        }
        if (flash > 0.01) {
          ctx.fillStyle = `rgba(235,240,255,${flash * 0.55})`
          ctx.fillRect(0, 0, w, h)
          flash *= 0.84
        }
      }
    }

    let raf = 0
    const loop = (t: number) => {
      draw(t)
      raf = requestAnimationFrame(loop)
    }
    if (reduce) draw(performance.now())
    else raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [rain, wind, lightning, night, lakeTop, demo])

  if (rain <= 0 && !lightning) return null
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
}
