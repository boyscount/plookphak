// ต้นซากุระของการ "ปลูก": ยิ่งจ่ายมาก ดอกยิ่งบาน — ค้างจ่ายแล้วต้นเหี่ยว ปิดยอดแล้วกลีบร่วงโปรย
import { useEffect, useState } from 'react'
import { cx } from './ui'

// สุ่มแบบกำหนดค่าได้ ให้ต้นหน้าตาเดิมทุกครั้ง
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

// ปลายกิ่ง (viewBox 200x180, โคนต้นอยู่ที่ 100,168)
const TIPS: [number, number][] = [
  [52, 66],
  [148, 60],
  [96, 34],
  [32, 84],
  [168, 80],
  [126, 38],
  [70, 40],
  [118, 82],
  [80, 84],
]

const BRANCHES = [
  'M100 168 C98 140 102 122 100 108',
  'M100 112 C88 96 70 82 52 66',
  'M101 110 C116 92 132 74 148 60',
  'M100 108 C99 84 97 58 96 34',
  'M95 100 C76 98 50 96 32 84',
  'M105 100 C126 98 150 94 168 80',
  'M99 76 C108 62 118 50 126 38',
  'M97 72 C88 60 78 50 70 40',
  'M100 104 C106 96 112 90 118 82',
  'M100 104 C93 96 87 90 80 84',
]

type Cluster = { x: number; y: number; r: number; order: number; tone: number }

const CLUSTERS: Cluster[] = (() => {
  const rand = rng(20261012)
  const out: Omit<Cluster, 'order'>[] = []
  for (const [tx, ty] of TIPS) {
    // พุ่มดอกรอบปลายกิ่ง + ไล่เข้ามาตามกิ่ง
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2
      const d = 4 + rand() * 13
      const towardTrunk = i < 2 ? 0 : (i - 1) * 0.12
      out.push({
        x: tx + Math.cos(a) * d + (100 - tx) * towardTrunk,
        y: ty + Math.sin(a) * d * 0.8 + (108 - ty) * towardTrunk,
        r: 6 + rand() * 4,
        tone: Math.floor(rand() * 3),
      })
    }
  }
  // บานจากใกล้ลำต้นออกไปปลายกิ่ง (มีสุ่มนิดหน่อยให้ดูธรรมชาติ)
  return out
    .map((c) => ({ c, k: Math.hypot(c.x - 100, c.y - 104) + rand() * 18 }))
    .sort((a, b) => a.k - b.k)
    .map(({ c }, order) => ({ ...c, order }))
})()

const TONES = ['#ffc1d6', '#ff9fbf', '#ffd9e6']
const WILT_TONES = ['#c9a3a8', '#b88a90', '#d8b9bc']

function Blossom({ c, wilted }: { c: Cluster; wilted: boolean }) {
  const fill = (wilted ? WILT_TONES : TONES)[c.tone]
  return (
    <g className="sakura-bloom" style={{ transformOrigin: `${c.x}px ${c.y}px`, animationDelay: `${(c.order % 12) * 40}ms` }}>
      <circle cx={c.x - c.r * 0.45} cy={c.y} r={c.r * 0.7} fill={fill} />
      <circle cx={c.x + c.r * 0.45} cy={c.y - c.r * 0.15} r={c.r * 0.72} fill={fill} />
      <circle cx={c.x} cy={c.y - c.r * 0.5} r={c.r * 0.68} fill={fill} />
      <circle cx={c.x} cy={c.y + c.r * 0.35} r={c.r * 0.62} fill={fill} />
      <circle cx={c.x} cy={c.y - c.r * 0.05} r={c.r * 0.18} fill={wilted ? '#e8d6a8' : '#fff4c4'} />
    </g>
  )
}

/**
 * progress: สัดส่วนที่จ่ายแล้ว 0..1
 * wilted: ค้างจ่ายอยู่ → สีซีด กิ่งลู่
 * full: ปิดยอดแล้ว → กลีบร่วงโปรย
 */
export function SakuraTree({
  progress,
  wilted = false,
  full = false,
  className,
}: {
  progress: number
  wilted?: boolean
  full?: boolean
  className?: string
}) {
  const shown = full ? CLUSTERS.length : Math.round(Math.max(0, Math.min(1, progress)) * CLUSTERS.length)
  return (
    <svg
      viewBox="0 0 200 180"
      className={cx('sakura-tree overflow-visible', wilted && 'is-wilted', className)}
      role="img"
      aria-label={`ต้นซากุระบาน ${Math.round(progress * 100)}%${wilted ? ' (ค้างจ่าย)' : ''}`}
    >
      <ellipse cx="100" cy="170" rx="70" ry="8" fill={wilted ? '#cbbfae' : '#cfe8c4'} opacity=".7" />
      <g className="sakura-sway" style={{ transformOrigin: '100px 168px' }}>
        <path
          d="M92 170 C96 150 94 128 97 108 L103 108 C106 128 104 150 108 170 Z"
          fill={wilted ? '#7a5a4a' : '#6b4330'}
        />
        {BRANCHES.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={wilted ? '#7a5a4a' : '#6b4330'} strokeWidth={i === 0 ? 0 : 4 - (i % 3) * 0.8} strokeLinecap="round" />
        ))}
        {/* ดอกตูมของดอกที่ยังไม่บาน */}
        {CLUSTERS.slice(shown).map((c) => (
          <circle key={`b${c.order}`} cx={c.x} cy={c.y} r={1.8} fill={wilted ? '#a88a8e' : '#e86a96'} opacity=".75" />
        ))}
        {CLUSTERS.slice(0, shown).map((c) => (
          <Blossom key={c.order} c={c} wilted={wilted} />
        ))}
      </g>
      {/* กลีบร่วงบนพื้นตอนเหี่ยว */}
      {wilted &&
        [60, 84, 118, 140].map((x, i) => (
          <ellipse key={x} cx={x} cy={166 + (i % 2) * 3} rx="3.2" ry="1.6" fill="#c9a3a8" transform={`rotate(${i * 35} ${x} 167)`} />
        ))}
      {/* ปิดยอด: กลีบร่วงโปรย */}
      {full &&
        Array.from({ length: 10 }, (_, i) => (
          <ellipse
            key={i}
            className="sakura-fall"
            cx={30 + ((i * 53) % 140)}
            cy={20}
            rx="3"
            ry="1.8"
            fill={TONES[i % 3]}
            style={{ animationDelay: `${i * 0.45}s`, animationDuration: `${4 + (i % 4)}s` }}
          />
        ))}
    </svg>
  )
}

/** กลีบซากุระร่วงทั้งจอ ใช้ตอนปิดยอด (ครั้งเดียวต่อรายการต่อเครื่อง) */
export function PetalShower({ id }: { id: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    try {
      const k = `petals:${id}`
      if (localStorage.getItem(k)) return
      localStorage.setItem(k, '1')
    } catch {
      return
    }
    setShow(true)
    const t = setTimeout(() => setShow(false), 5000)
    return () => clearTimeout(t)
  }, [id])
  return show ? <Petals count={36} className="fixed inset-0 z-[60]" once /> : null
}

/** ชั้นกลีบซากุระร่วง (ใช้ซ้ำใน cover ธีมซากุระ) */
export function Petals({
  count = 14,
  className,
  once = false,
  short = false,
}: {
  count?: number
  className?: string
  once?: boolean
  /** ร่วงระยะสั้น (ใน cover ที่สูงไม่กี่ร้อย px) */
  short?: boolean
}) {
  return (
    <div className={cx('pointer-events-none overflow-hidden', className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cx('petal', once && 'petal-once', short && 'petal-short')}
          style={{
            left: `${(i * 37 + 7) % 100}%`,
            animationDelay: `${(i * 0.53) % (once ? 1.6 : 9)}s`,
            animationDuration: `${(once ? 2.6 : short ? 4 : 7) + (i % 5) * 0.7}s`,
            width: 8 + (i % 3) * 3,
            height: 6 + (i % 3) * 2,
            background: TONES[i % 3],
          }}
        />
      ))}
    </div>
  )
}
