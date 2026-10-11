// ฉากหน้า login: เรือนญี่ปุ่นกลางทะเลสาบ ซ้อนเป็นชั้น (parallax) — ภูเขา, หมอก, เรือน, กิ่งซากุระ, กลีบร่วง
// กลางวัน/กลางคืนตามเวลาไทย · เอียงมือถือหรือขยับเมาส์แล้วชั้นต่าง ๆ เลื่อนเหลื่อมกัน
import { useEffect, useRef, type ReactNode } from 'react'
import { Petals } from './SakuraTree'

function isNightBkk() {
  const h = new Date(Date.now() + 7 * 3_600_000).getUTCHours()
  return h >= 18 || h < 6
}

const DAY = {
  sky: ['#bfe3e6', '#e9f3ee'],
  far: '#9cc5c4',
  mid: '#7fb0ae',
  near: '#6a9e9b',
  mist: 'rgba(255,255,255,.75)',
  lake: ['#7fc6bf', '#4f9e98'],
  wood: '#7a3b24',
  roof: '#2f3a44',
  paper: '#f4e6c8',
  glow: 'rgba(255,214,140,0)',
  blossom: ['#ffc1d6', '#ff9fbf', '#ffd9e6'],
  branch: '#5a3626',
}
const NIGHT = {
  sky: ['#0b1430', '#1b2450'],
  far: '#1a2346',
  mid: '#16203e',
  near: '#121a33',
  mist: 'rgba(140,160,220,.18)',
  lake: ['#0f1a3a', '#070d22'],
  wood: '#3b1f15',
  roof: '#10151d',
  paper: '#ffd98a',
  glow: 'rgba(255,200,110,.55)',
  blossom: ['#b5788f', '#9c5f78', '#c98ea3'],
  branch: '#24170f',
}

/** ชั้นที่เลื่อนตาม parallax (depth มาก = ใกล้ = เลื่อนมาก) */
function Layer({ depth, children }: { depth: number; children: ReactNode }) {
  return (
    <g className="login-layer" data-depth={depth}>
      {children}
    </g>
  )
}

function Blossoms({ points, colors }: { points: [number, number, number][]; colors: string[] }) {
  return (
    <>
      {points.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x - r * 0.4} cy={y} r={r * 0.7} fill={colors[i % 3]} />
          <circle cx={x + r * 0.4} cy={y - r * 0.2} r={r * 0.7} fill={colors[(i + 1) % 3]} />
          <circle cx={x} cy={y - r * 0.5} r={r * 0.65} fill={colors[(i + 2) % 3]} />
        </g>
      ))}
    </>
  )
}

const LEFT_BLOSSOMS: [number, number, number][] = [
  [8, 40, 16], [30, 30, 13], [52, 50, 14], [20, 70, 15], [70, 34, 11], [44, 80, 12], [88, 60, 10], [6, 100, 14], [62, 96, 9],
]
const RIGHT_BLOSSOMS: [number, number, number][] = LEFT_BLOSSOMS.map(([x, y, r]) => [400 - x, y + 6, r])

export function LoginScene({ children }: { children?: ReactNode }) {
  const night = isNightBkk()
  const c = night ? NIGHT : DAY
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const layers = [...el.querySelectorAll<SVGGElement>('.login-layer')]
    const move = (x: number, y: number) => {
      for (const l of layers) {
        const d = Number(l.dataset.depth)
        l.style.transform = `translate(${x * d}px, ${y * d * 0.5}px)`
      }
    }
    const onMouse = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      move((e.clientX / innerWidth - 0.5) * -2, (e.clientY / innerHeight - 0.5) * -2)
    }
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      move(Math.max(-1, Math.min(1, e.gamma / 25)) * -1, Math.max(-1, Math.min(1, (e.beta - 45) / 25)) * -1)
    }
    window.addEventListener('pointermove', onMouse)
    window.addEventListener('deviceorientation', onTilt)
    return () => {
      window.removeEventListener('pointermove', onMouse)
      window.removeEventListener('deviceorientation', onTilt)
    }
  }, [])

  const lanterns = [146, 162, 178, 194, 210, 226, 242, 258]

  return (
    <div ref={root} className="pt-safe relative h-[25rem] overflow-hidden">
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.sky[0]} />
            <stop offset="1" stopColor={c.sky[1]} />
          </linearGradient>
          <linearGradient id="ls-lake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.lake[0]} />
            <stop offset="1" stopColor={c.lake[1]} />
          </linearGradient>
          <radialGradient id="ls-glow">
            <stop offset="0" stopColor={night ? 'rgba(255,205,120,.7)' : 'rgba(255,255,255,0)'} />
            <stop offset="1" stopColor="rgba(255,205,120,0)" />
          </radialGradient>
          <filter id="ls-blur">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <rect width="400" height="300" fill="url(#ls-sky)" />
        {night &&
          Array.from({ length: 30 }, (_, i) => (
            <circle key={i} className="cover-star" cx={(i * 53) % 400} cy={(i * 29) % 120} r={i % 4 ? 0.8 : 1.4} fill="#fff" style={{ animationDelay: `${(i % 7) * 0.4}s` }} />
          ))}
        {night && <circle cx="320" cy="50" r="14" fill="#fff4d6" opacity=".9" />}

        <Layer depth={2}>
          <path d="M-20 170 L40 120 L90 150 L150 100 L210 140 L270 96 L330 136 L420 110 L420 200 L-20 200 Z" fill={c.far} />
        </Layer>
        <Layer depth={4}>
          <path d="M-20 185 L60 145 L120 172 L190 135 L250 168 L320 140 L420 170 L420 210 L-20 210 Z" fill={c.mid} />
          <rect x="-20" y="160" width="440" height="40" fill={c.mist} filter="url(#ls-blur)" />
        </Layer>

        {/* ทะเลสาบ */}
        <rect y="196" width="400" height="104" fill="url(#ls-lake)" />
        {[212, 228, 246, 266, 286].map((y, i) => (
          <path key={y} className="lake-shimmer" d={`M${20 + i * 30} ${y} h${60 - i * 4} M${240 - i * 20} ${y + 6} h${50}`} stroke={night ? 'rgba(255,214,140,.25)' : 'rgba(255,255,255,.5)'} strokeWidth="1.4" strokeLinecap="round" style={{ animationDelay: `${i * 0.6}s` }} />
        ))}

        {/* เรือนน้ำชา */}
        <Layer depth={7}>
          <ellipse cx="200" cy="160" rx="110" ry="60" fill="url(#ls-glow)" />
          {/* เงาสะท้อนในน้ำ */}
          <g opacity={night ? 0.35 : 0.25} transform="translate(0 412) scale(1 -1)">
            <rect x="140" y="140" width="120" height="58" fill={c.wood} />
            <rect x="152" y="110" width="96" height="34" fill={c.wood} />
          </g>
          {/* เสาใต้ชาน */}
          {[132, 160, 190, 220, 250, 268].map((x) => (
            <rect key={x} x={x} y="196" width="3" height="14" fill={c.wood} />
          ))}
          <rect x="122" y="190" width="156" height="8" rx="1" fill={c.wood} />
          <rect x="140" y="146" width="120" height="44" fill={c.wood} />
          {/* ประตูกระดาษ */}
          {[148, 172, 196, 220, 244].map((x) => (
            <rect key={x} x={x} y="156" width="18" height="30" fill={c.paper} opacity={night ? 0.95 : 0.85} />
          ))}
          <path d="M126 150 L200 128 L274 150 L262 152 L200 136 L138 152 Z" fill={c.roof} />
          <rect x="152" y="112" width="96" height="22" fill={c.wood} />
          <rect x="176" y="116" width="48" height="14" fill={c.paper} opacity=".9" />
          <path d="M140 116 L200 92 L260 116 L250 118 L200 100 L150 118 Z" fill={c.roof} />
          {/* โคมไฟ */}
          {lanterns.map((x, i) => (
            <g key={x}>
              {night && <circle cx={x} cy="144" r="7" fill="rgba(255,200,110,.35)" />}
              <ellipse className={night ? 'lantern-glow' : undefined} cx={x} cy="144" rx="3" ry="4" fill={night ? '#ffd27a' : '#fff6e0'} style={{ animationDelay: `${i * 0.3}s` }} />
            </g>
          ))}
          {/* เรือที่ท่า */}
          <path d="M214 222 q26 10 52 0 l-6 6 q-20 6 -40 0 z" fill={night ? '#2a1a12' : '#6b3f26'} />
        </Layer>

        {/* กิ่งซากุระหน้าสุด */}
        <Layer depth={12}>
          <path d="M-10 120 C30 90 60 70 100 56 M10 70 C30 50 50 40 70 30" stroke={c.branch} strokeWidth="5" fill="none" strokeLinecap="round" />
          <Blossoms points={LEFT_BLOSSOMS} colors={c.blossom} />
          <path d="M410 126 C370 96 340 76 300 62 M390 76 C370 56 350 46 330 36" stroke={c.branch} strokeWidth="5" fill="none" strokeLinecap="round" />
          <Blossoms points={RIGHT_BLOSSOMS} colors={c.blossom} />
        </Layer>
      </svg>
      <Petals count={12} className="absolute inset-0" short />
      <div className="relative">{children}</div>
    </div>
  )
}
