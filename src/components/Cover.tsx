// แถบ cover ด้านบนหน้าโปรไฟล์: ธีมให้เลือก, แสงเหนือเคลื่อนช้า ๆ, เหรียญลอย, ดาวตอนกลางคืน, คำทักทายตามเวลา
import { useEffect, useState, type ReactNode } from 'react'
import { cx } from './ui'

type Theme = {
  id: string
  label: string
  base: string
  blobs: [string, string, string]
  ink: 'light' | 'dark'
  alwaysStars?: boolean
}

export const COVERS: Theme[] = [
  { id: 'violet', label: 'ม่วงคลาสสิก', base: 'linear-gradient(160deg,#4b22a8 0%,#6d32e0 55%,#9a5cff 100%)', blobs: ['#ff7ad9', '#7aa2ff', '#c08bff'], ink: 'light' },
  { id: 'noir_gold', label: 'ดำ-ทองหรู', base: 'linear-gradient(160deg,#0b0906 0%,#1e1709 60%,#3a2a0c 100%)', blobs: ['#c99a35', '#f6dc8a', '#6b4e12'], ink: 'light' },
  { id: 'pastel', label: 'ชมพูพาสเทล', base: 'linear-gradient(160deg,#ffc2dc 0%,#e3c8ff 60%,#c7d8ff 100%)', blobs: ['#fff0b3', '#ff9fd0', '#a6e3ff'], ink: 'dark' },
  { id: 'night', label: 'ท้องฟ้ายามค่ำ', base: 'linear-gradient(170deg,#070b2a 0%,#1a1550 60%,#3a2380 100%)', blobs: ['#3b5bdb', '#9b5de5', '#0ea5e9'], ink: 'light', alwaysStars: true },
  { id: 'ocean', label: 'ทะเลเขตร้อน', base: 'linear-gradient(160deg,#055a8c 0%,#0b8fb3 55%,#36c9c6 100%)', blobs: ['#7cf5d6', '#3b82f6', '#a5f3fc'], ink: 'light' },
  { id: 'sunset', label: 'พระอาทิตย์ตก', base: 'linear-gradient(160deg,#5b1a6e 0%,#d9467a 55%,#ff9f5a 100%)', blobs: ['#ffd36e', '#ff6fa0', '#8b5cf6'], ink: 'light' },
  { id: 'sakura', label: 'ซากุระ', base: 'linear-gradient(160deg,#ffdbe9 0%,#ffc2d9 50%,#fff3f8 100%)', blobs: ['#ff9fc6', '#ffffff', '#ffd1e3'], ink: 'dark' },
  { id: 'matcha', label: 'มัทฉะ', base: 'linear-gradient(160deg,#4f7a3a 0%,#8fb06a 55%,#dfe8c4 100%)', blobs: ['#c8e09a', '#6f9a4a', '#fff8dc'], ink: 'light' },
  { id: 'neon', label: 'นีออนไซเบอร์', base: 'linear-gradient(160deg,#0a0618 0%,#1c0b3a 55%,#08263d 100%)', blobs: ['#ff2fd6', '#00e5ff', '#7c3aed'], ink: 'light', alwaysStars: true },
  { id: 'galaxy', label: 'กาแล็กซี่', base: 'radial-gradient(120% 140% at 70% 0%,#5b2a9e 0%,#24104f 45%,#05020f 100%)', blobs: ['#ff7ad9', '#4f46e5', '#22d3ee'], ink: 'light', alwaysStars: true },
]

export function coverById(id: string | null | undefined) {
  return COVERS.find((c) => c.id === id) ?? COVERS[0]
}

/** ชั่วโมงตามเวลาไทย */
function bkkHour(ms = Date.now()) {
  return new Date(ms + 7 * 3_600_000).getUTCHours()
}

export function greeting(h = bkkHour()) {
  if (h >= 5 && h < 11) return 'อรุณสวัสดิ์ ☀️'
  if (h >= 11 && h < 13) return 'เที่ยงแล้ว กินข้าวยัง 🍜'
  if (h >= 13 && h < 17) return 'สวัสดีตอนบ่าย 🌤️'
  if (h >= 17 && h < 20) return 'สวัสดีตอนเย็น 🌇'
  if (h >= 20) return 'ดึกแล้วนะ 🌙'
  return 'ยังไม่นอนอีก 😴'
}

const isNight = (h = bkkHour()) => h >= 19 || h < 6

// ตำแหน่งคงที่ (ไม่สุ่มทุก render)
const COINS = [
  { left: 8, size: 18, dur: 11, delay: 0 },
  { left: 22, size: 12, dur: 14, delay: 3 },
  { left: 41, size: 16, dur: 12, delay: 6 },
  { left: 58, size: 11, dur: 15, delay: 1.5 },
  { left: 73, size: 20, dur: 13, delay: 4.5 },
  { left: 88, size: 13, dur: 16, delay: 8 },
]
const SPARKS = [
  { left: 15, top: 30, delay: 0 },
  { left: 34, top: 62, delay: 1.2 },
  { left: 52, top: 22, delay: 2.1 },
  { left: 67, top: 55, delay: 0.6 },
  { left: 83, top: 35, delay: 1.8 },
]
const STARS = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 90,
  size: i % 5 === 0 ? 2.5 : 1.5,
  delay: (i % 7) * 0.5,
}))

function Coin({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx="12" cy="12" r="10.5" fill="#ffc95c" stroke="#7a5a17" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="#fff3c4" strokeWidth="1" opacity=".8" />
      <path d="M10 7.5v9M10 7.5h2.6a2 2 0 0 1 0 4H10M10 11.5h3a2.1 2.1 0 0 1 0 4.2H10M11.5 6v12" fill="none" stroke="#7a5a17" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function Cover({ theme, name, children }: { theme?: string | null; name?: string; children?: ReactNode }) {
  const t = coverById(theme)
  const [hour, setHour] = useState(bkkHour)
  useEffect(() => {
    const id = setInterval(() => setHour(bkkHour()), 60_000)
    return () => clearInterval(id)
  }, [])
  const stars = t.alwaysStars || isNight(hour)
  const light = t.ink === 'light'

  return (
    <div className="cover pt-safe relative h-40 overflow-hidden px-4 sm:h-48 sm:rounded-b-[2rem]" style={{ background: t.base }}>
      {/* แสงเหนือ */}
      <div className="cover-blob cover-blob-a" style={{ background: t.blobs[0] }} />
      <div className="cover-blob cover-blob-b" style={{ background: t.blobs[1] }} />
      <div className="cover-blob cover-blob-c" style={{ background: t.blobs[2] }} />

      {stars &&
        STARS.map((s, i) => (
          <span
            key={i}
            className="cover-star absolute rounded-full bg-white"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
          />
        ))}

      {COINS.map((c, i) => (
        <span
          key={i}
          className="cover-coin absolute bottom-0"
          style={{ left: `${c.left}%`, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}
        >
          <Coin size={c.size} />
        </span>
      ))}
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className={cx('cover-spark absolute text-sm', light ? 'text-white' : 'text-[#7a5a17]')}
          style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s` }}
        >
          ✦
        </span>
      ))}

      <div className="relative flex items-center justify-between pt-2">{children}</div>

      <p
        className={cx(
          'absolute right-4 bottom-3 max-w-[60%] text-right text-sm leading-tight font-semibold drop-shadow sm:right-6',
          light ? 'text-white' : 'text-[#3a1c5c]',
        )}
      >
        {greeting(hour)}
        {name && <span className="block truncate text-xs font-medium opacity-85">{name}</span>}
      </p>
    </div>
  )
}

/** ตัวอย่างย่อสำหรับหน้าเลือกธีม */
export function CoverSwatch({ id }: { id: string }) {
  const t = coverById(id)
  return (
    <span className="relative block h-16 w-full overflow-hidden rounded-xl" style={{ background: t.base }}>
      <span className="absolute -top-4 -left-3 size-12 rounded-full opacity-70 blur-md" style={{ background: t.blobs[0] }} />
      <span className="absolute -right-3 -bottom-5 size-12 rounded-full opacity-70 blur-md" style={{ background: t.blobs[1] }} />
      <span className="absolute right-2 bottom-2">
        <Coin size={14} />
      </span>
    </span>
  )
}
