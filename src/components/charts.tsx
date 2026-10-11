// กราฟแบบ SVG/HTML ล้วน ไม่พึ่ง library
// สีแยกประเภทเงินตรวจด้วย dataviz validator แล้ว (light, #fff): ผ่านทุกข้อ, เขียวคอนทราสต์ต่ำ → แสดงค่ากำกับเสมอ
import { useEffect, useRef, useState } from 'react'
import { fmtBaht } from '../lib/format'
import type { DayStatus } from '../lib/loanMath'
import { cx } from './ui'

export const MONEY_COLORS = {
  // ค่าจริงอยู่ใน index.css (--money-*) แยกสว่าง/มืด ผ่าน validator ทั้งสองโหมด
  principal: 'var(--money-principal)', // เงินต้น
  interest: 'var(--money-interest)', // ดอกเบี้ย
  penalty: 'var(--money-penalty)', // ค่าปรับ
}

/** ตัวเลขวิ่งขึ้นตอนเปิดหน้า แล้วตามค่าจริงแบบนุ่ม ๆ */
export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const start = from.current
    if (reduce || Math.abs(target - start) < 0.5) {
      from.current = target
      setV(target)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      const cur = start + (target - start) * e
      from.current = cur
      setV(cur)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

export function CountUpBaht({ value, className }: { value: number; className?: string }) {
  const v = useCountUp(value)
  return <span className={cx('tabular', className)}>{fmtBaht(Math.round(v))}</span>
}

/** วงแหวนความคืบหน้า (สัดส่วนเดียว — ไม่ใช่ pie หลายชิ้น) */
export function ProgressRing({
  value,
  size = 96,
  stroke = 10,
  color = 'var(--money-principal)',
  track = 'var(--color-brand-100)',
  label,
  sub,
}: {
  value: number // 0..1
  size?: number
  stroke?: number
  color?: string
  track?: string
  label?: React.ReactNode
  sub?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(Math.max(0, Math.min(1, value))))
    return () => cancelAnimationFrame(id)
  }, [value])
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(value * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-tight">
        <div>
          <div className="tabular text-lg font-bold">{label ?? `${Math.round(value * 100)}%`}</div>
          {sub && <div className="text-[11px] text-muted">{sub}</div>}
        </div>
      </div>
    </div>
  )
}

type Segment = { key: string; label: string; value: number; color: string }

/** แท่งซ้อนแนวนอน + คำอธิบายพร้อมตัวเลขเสมอ (เอกลักษณ์ไม่พึ่งสีอย่างเดียว) */
export function StackedBar({ segments, height = 14 }: { segments: Segment[]; height?: number }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0)
  const [hover, setHover] = useState<string | null>(null)
  const visible = segments.filter((s) => s.value > 0)
  return (
    <div>
      <div className="flex w-full gap-[2px] overflow-hidden rounded-full bg-pill" style={{ height }}>
        {total > 0 &&
          visible.map((s) => (
            <div
              key={s.key}
              title={`${s.label} ${fmtBaht(s.value)}`}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              className="h-full transition-[flex-grow,opacity] duration-700 first:rounded-l-full last:rounded-r-full"
              style={{ flexGrow: s.value, flexBasis: 0, background: s.color, opacity: hover && hover !== s.key ? 0.35 : 1 }}
            />
          ))}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2 text-sm">
        {segments.map((s) => (
          <li
            key={s.key}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            className={cx('rounded-xl px-2 py-1.5 transition', hover === s.key && 'bg-canvas')}
          >
            <span className="flex items-center gap-1.5 text-muted">
              <span className="size-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="tabular block font-semibold">{fmtBaht(s.value)}</span>
            <span className="tabular block text-xs text-muted">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** อันดับแนวนอน สีเดียว (ขนาด) */
export function RankBars({
  rows,
  color = 'var(--money-principal)',
  onPick,
}: {
  rows: { key: string; label: React.ReactNode; value: number }[]
  color?: string
  onPick?: (key: string) => void
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <button type="button" onClick={() => onPick?.(r.key)} className="w-full text-left">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="tabular shrink-0 font-semibold">{fmtBaht(r.value)}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-pill">
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

const dayStyle: Record<DayStatus, { cls: string; icon: string; label: string }> = {
  on_time: { cls: 'bg-emerald-100 text-ok', icon: '✓', label: 'จ่ายทัน' },
  late: { cls: 'bg-amber-100 text-amber-700', icon: '!', label: 'จ่ายช้า' },
  missed: { cls: 'bg-red-100 text-danger', icon: '✕', label: 'ยังไม่จ่าย' },
  today: { cls: 'bg-brand-50 text-brand-700 ring-2 ring-brand-400', icon: '•', label: 'รอบวันนี้' },
  none: { cls: 'bg-pill text-muted/60', icon: '–', label: 'ยังไม่เริ่ม' },
}

/** แถบประวัติดอกรายวัน: สถานะมีไอคอน + คำอธิบาย ไม่ใช้สีอย่างเดียว */
export function DayStrip({ days }: { days: { date: string; status: DayStatus }[] }) {
  const onTime = days.filter((d) => d.status === 'on_time').length
  const counted = days.filter((d) => d.status !== 'none' && d.status !== 'today').length
  // จ่ายทันติดกันล่าสุด
  let streak = 0
  for (const d of [...days].reverse()) {
    if (d.status === 'today') continue
    if (d.status === 'on_time') streak++
    else break
  }
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-semibold">ประวัติจ่ายดอก {days.length} วันล่าสุด</span>
        <span className="text-muted">
          ทัน {onTime}/{counted} วัน{streak >= 3 && <span className="ml-1 font-semibold text-brand-700">🔥 ติดกัน {streak}</span>}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => (
          <div
            key={d.date}
            title={`${new Date(d.date).getUTCDate()} · ${dayStyle[d.status].label}`}
            className={cx('flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-bold', dayStyle[d.status].cls)}
          >
            <span className="text-[10px] font-medium opacity-70">{new Date(d.date).getUTCDate()}</span>
            {dayStyle[d.status].icon}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {(['on_time', 'late', 'missed', 'today'] as DayStatus[]).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className={cx('grid size-4 place-items-center rounded text-[10px] font-bold', dayStyle[k].cls)}>{dayStyle[k].icon}</span>
            {dayStyle[k].label}
          </span>
        ))}
      </div>
    </div>
  )
}
