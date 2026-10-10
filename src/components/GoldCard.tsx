import { useEffect, useRef } from 'react'
import { cx, Logo } from './ui'

/** เลขบัตรหลอกจาก id (4 หลักท้ายคงที่ต่อคน) */
function last4(seed: string) {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return String(h % 10000).padStart(4, '0')
}

function Chip() {
  return (
    <svg viewBox="0 0 50 38" className="h-[30px] w-[40px] shrink-0" aria-hidden>
      <defs>
        <linearGradient id="chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff4c9" />
          <stop offset=".5" stopColor="#d9b25a" />
          <stop offset="1" stopColor="#a8822e" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="48" height="36" rx="7" fill="url(#chip)" stroke="#7a5a17" strokeWidth="1.2" />
      <path d="M1 13h15M1 25h15M34 13h15M34 25h15M16 1v36M34 1v36M16 19h18" stroke="#7a5a17" strokeWidth="1.2" fill="none" />
    </svg>
  )
}

function Contactless() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 opacity-70" fill="none" stroke="#5c4310" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M8 8a6 6 0 0 1 0 8M12 5.5a10 10 0 0 1 0 13M16 3a14 14 0 0 1 0 18" />
    </svg>
  )
}

export type CardVariant = 'gold' | 'platinum' | 'silver' | 'black'

const DEG = 180 / Math.PI
const FRONT = -14 // มุมที่ keyframe 0% ของ gold-spin
const BACK = 180 // มุมที่ keyframe 50%
const SPIN_SECONDS = 14
const EDGE_LAYERS = [-1.6, -1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2, 1.6]

/** มุม rotateY ปัจจุบันจาก transform ที่คำนวณแล้ว (ระหว่าง animation) */
function currentAngle(el: HTMLElement) {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
  return Math.atan2(-m.m13, m.m11) * DEG
}

/** มุมด้านหน้า/หลังที่ใกล้ที่สุด */
function nearestFace(angle: number) {
  const f = 360 * Math.round((angle - FRONT) / 360) + FRONT
  const b = 360 * Math.round((angle - BACK) / 360) + BACK
  return Math.abs(angle - f) <= Math.abs(angle - b) ? { angle: f, back: false } : { angle: b, back: true }
}

type OrientationCtor = { requestPermission?: () => Promise<'granted' | 'denied'> }

/**
 * บัตรสมาชิกหมุนช้า ๆ (3D) — หน้าบัตร: ชิป, เลขบัตร, ชื่อ / หลังบัตร: แถบแม่เหล็ก, ลายเซ็น
 * ปัดซ้ายขวาเพื่อหมุนเอง · แตะเพื่อพลิก · เอียงมือถือ/เลื่อนเมาส์ บัตรเอียงตาม
 * ผู้ใช้ที่ตั้งลดการเคลื่อนไหวไว้ จะเห็นบัตรเอียงนิ่ง ๆ (ยังปัด/แตะได้)
 */
export function GoldCard({
  name,
  seed,
  tier = 'GOLD MEMBER',
  variant = 'gold',
  caption,
  className,
}: {
  name: string
  seed: string
  tier?: string
  variant?: CardVariant
  caption?: string
  className?: string
}) {
  const num = last4(seed || name || 'plookphak')
  const spinRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; t: number; angle: number; v: number; moved: number } | null>(null)
  const resumeTimer = useRef<number | undefined>(undefined)
  const raf = useRef<number | undefined>(undefined)

  // เอียงตามมือถือ (Android ได้เลย, iOS ต้องขอสิทธิ์ตอนแตะครั้งแรก) และตามเมาส์บนคอม
  const applyTilt = (rx: number, ry: number) => {
    if (tiltRef.current) tiltRef.current.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`
  }
  useEffect(() => {
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v))
      applyTilt(clamp((e.beta - 45) / 4, 10), clamp(e.gamma / 3, 14))
    }
    window.addEventListener('deviceorientation', onOrient)

    // แสงสะท้อนและเงาบนพื้นตามมุมบัตรจริง (ทั้งตอนหมุนเองและตอนปัด)
    let light = 0
    const loop = () => {
      const el = spinRef.current
      const stage = stageRef.current
      if (el && stage) {
        const a = currentAngle(el) / DEG
        stage.style.setProperty('--card-cos', Math.abs(Math.cos(a)).toFixed(3))
        stage.style.setProperty('--card-glare', `${(50 - Math.sin(a) * 90).toFixed(1)}%`)
      }
      light = requestAnimationFrame(loop)
    }
    light = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(light)
      window.removeEventListener('deviceorientation', onOrient)
      clearTimeout(resumeTimer.current)
      cancelAnimationFrame(raf.current!)
    }
  }, [])

  const setManual = (angle: number, transition = '') => {
    const el = spinRef.current!
    el.style.animation = 'none'
    el.style.transition = transition
    el.style.transform = `rotateY(${angle}deg) rotateX(6deg)`
  }

  /** ค่อย ๆ เข้าด้านที่ใกล้สุด แล้วกลับไปหมุนเองจากจุดนั้น */
  const settle = (angle: number) => {
    const face = nearestFace(angle)
    setManual(face.angle, 'transform 700ms cubic-bezier(.2,.8,.2,1)')
    clearTimeout(resumeTimer.current)
    resumeTimer.current = window.setTimeout(() => {
      const el = spinRef.current
      if (!el) return
      el.style.transition = ''
      el.style.transform = ''
      el.style.animation = ''
      el.style.animationDelay = face.back ? `-${SPIN_SECONDS / 2}s` : '0s'
    }, 3500)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const el = spinRef.current!
    cancelAnimationFrame(raf.current!)
    clearTimeout(resumeTimer.current)
    const angle = currentAngle(el)
    setManual(angle)
    drag.current = { x: e.clientX, t: performance.now(), angle, v: 0, moved: 0 }
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // pointer หายไปแล้ว — ไม่เป็นไร
    }
    // iOS: ขอสิทธิ์อ่านการเอียงมือถือจากการแตะของผู้ใช้
    const ctor = window.DeviceOrientationEvent as unknown as OrientationCtor | undefined
    ctor?.requestPermission?.().catch(() => {})
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) {
      // เมาส์ลอยบนบัตร (คอม): เอียงตามตำแหน่ง
      if (e.pointerType === 'mouse') {
        const r = e.currentTarget.getBoundingClientRect()
        applyTilt(((e.clientY - r.top) / r.height - 0.5) * -14, ((e.clientX - r.left) / r.width - 0.5) * 18)
      }
      return
    }
    const now = performance.now()
    const dx = e.clientX - d.x
    d.angle += dx * 0.6
    // องศาต่อเฟรม (จำกัดไม่ให้ปัดแรงแล้วหมุนเป็นพัดลม)
    d.v = Math.max(-25, Math.min(25, ((dx * 0.6) / Math.max(8, now - d.t)) * 16))
    d.moved += Math.abs(dx)
    d.x = e.clientX
    d.t = now
    setManual(d.angle)
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.moved < 6) {
      // แตะ = พลิกไปอีกด้าน
      const face = nearestFace(d.angle)
      settle(face.angle + 180)
      return
    }
    // ปล่อยแล้วหมุนต่อตามแรง แล้วค่อยเข้าด้าน
    let { angle, v } = d
    const step = () => {
      angle += v
      v *= 0.94
      setManual(angle)
      if (Math.abs(v) > 0.3) raf.current = requestAnimationFrame(step)
      else settle(angle)
    }
    raf.current = requestAnimationFrame(step)
  }

  return (
    <div
      ref={stageRef}
      className={cx('gold-stage relative mx-auto w-full max-w-[340px] pb-6', `card-${variant}`, className)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && !drag.current && applyTilt(0, 0)}
    >
      <div ref={tiltRef} className="gold-tilt">
      <div
        ref={spinRef}
        className="gold-spin relative aspect-[1.586] w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label={`บัตรสมาชิก ${tier} ของ ${name}`}
      >
        {/* ความหนาของบัตร: แผ่นบาง ๆ ซ้อนกัน เห็นเป็นขอบตอนบัตรตะแคง */}
        {EDGE_LAYERS.map((z) => (
          <div key={z} className="gold-edge absolute inset-0 rounded-[18px]" style={{ transform: `translateZ(${z}px)` }} />
        ))}
        {/* หน้าบัตร */}
        <div className="gold-face gold-front gold-surface absolute inset-0 flex flex-col justify-between rounded-[18px] p-[6%]">
          <div className="gold-shine" />
          <div className="relative flex items-start justify-between">
            <span className="flex items-center gap-1.5">
              <Logo className="size-6" />
              <span className="gold-emboss text-[15px] font-bold tracking-wide">Plookphak</span>
            </span>
            <span className="gold-emboss text-[10px] font-semibold tracking-[.2em]">{tier}</span>
          </div>
          <div className="relative flex items-center gap-3">
            <Chip />
            <Contactless />
          </div>
          <div className="relative">
            <p className="gold-emboss tabular text-[clamp(13px,4.6vw,18px)] leading-tight font-semibold tracking-[.12em]">
              •••• •••• •••• {num}
            </p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <span className="min-w-0">
                <span className="gold-emboss block text-[8px] tracking-[.2em] opacity-70">CARD HOLDER</span>
                <span className="gold-emboss block truncate text-[13px] font-semibold uppercase tracking-wider">{name || 'YOUR NAME'}</span>
              </span>
              {caption && (
                <span className="shrink-0 text-right">
                  <span className="gold-emboss block text-[8px] tracking-[.2em] opacity-70">BALANCE</span>
                  <span className="gold-emboss tabular block text-[13px] font-bold">{caption}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* หลังบัตร */}
        <div className="gold-face gold-back gold-surface absolute inset-0 overflow-hidden rounded-[18px]">
          <div className="gold-shine" />
          <div className="mt-[8%] h-[18%] bg-[#1b1406]" />
          <div className="mx-[6%] mt-[5%] flex items-center gap-2">
            <div className="h-8 flex-1 rounded bg-[repeating-linear-gradient(135deg,#fffbe8_0_6px,#f1e3b0_6px_12px)] px-2 text-right font-serif text-sm leading-8 italic text-[#5c4310]">
              {name}
            </div>
            <div className="grid h-8 w-12 place-items-center rounded bg-white text-xs font-bold text-[#5c4310] italic">{num.slice(1)}</div>
          </div>
          <p className="gold-emboss mx-[6%] mt-[4%] text-[9px] leading-snug opacity-80">
            บัตรนี้ใช้แสดงสถานะสมาชิกใน Plookphak เท่านั้น ไม่ใช่บัตรชำระเงินจริง
          </p>
          <div className="absolute right-[6%] bottom-[7%] flex items-center gap-1.5">
            <Logo className="size-6" />
            <span className="gold-emboss text-[11px] font-bold">Plookphak</span>
          </div>
        </div>
      </div>
      </div>
      {/* เงาบนพื้น หดเมื่อบัตรตะแคง */}
      <div className="gold-floor" aria-hidden />
    </div>
  )
}
