// เรือนน้ำชาของ admin: ทุกคนในเรือนเดียว ชั้นที่ต้องตามเรียงไว้ล่างสุด
import { lazy, Suspense, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RoundButton } from '../components/AppShell'
import { catColorOf } from '../components/avatars'
import { TierChip } from '../components/Badges'
import type { FloorInfo } from '../components/cat3d/Building'
import { BackIcon } from '../components/icons'
import { Avatar, cx, Pill, Spinner } from '../components/ui'
import { catLine, catStats } from '../lib/catStats'
import { fmtBaht } from '../lib/format'
import { loanSnapshot } from '../lib/loanMath'
import { useLoans, useNow, useProfiles } from '../lib/queries'

const Building = lazy(() => import('../components/cat3d/Building'))
const FLOOR_H = 1.7 // ต้องตรงกับ Building.tsx
const BASE = 0.6 // ความสูงชานเหนือน้ำ ต้องตรงกับ Building.tsx

const MOOD_RANK = { sad: 0, hungry: 1, ok: 2, happy: 3 }

export function CatBuilding() {
  const navigate = useNavigate()
  const { data: people, isLoading: l1 } = useProfiles('borrower')
  const { data: loans, isLoading: l2 } = useLoans()
  const now = useNow(30_000)
  const [selected, setSelected] = useState<string | null>(null)
  const [focus, setFocus] = useState(0)

  const rows = useMemo(() => {
    return (people ?? [])
      .filter((p) => p.active)
      .map((p) => {
        const mine = (loans ?? []).filter((l) => l.borrower_id === p.id)
        const stats = catStats(mine, now)
        const balance = mine.reduce((s, l) => s + loanSnapshot(l, l.payments, now).balance, 0)
        const pending = mine.flatMap((l) => l.payments).filter((x) => x.status === 'pending').length
        return { person: p, stats, balance, pending }
      })
      .sort((a, b) => MOOD_RANK[a.stats.mood] - MOOD_RANK[b.stats.mood] || b.balance - a.balance)
  }, [people, loans, now])

  if (l1 || l2) return <Spinner />

  const floors: FloorInfo[] = rows.map((r) => ({
    id: r.person.id,
    name: r.person.aka,
    color: catColorOf(r.person.avatar),
    mood: r.stats.mood,
    fullness: r.stats.fullness,
    balance: fmtBaht(r.balance),
    overdue: r.stats.lateHours >= 1,
    closed: r.balance <= 0,
    pendingSlips: r.pending,
  }))
  const outstanding = rows.reduce((s, r) => s + r.balance, 0)
  const collected = (loans ?? [])
    .flatMap((l) => l.payments)
    .filter((p) => p.status === 'approved')
    .reduce((s, p) => s + Number(p.amount), 0)
  const rate = collected + outstanding > 0 ? collected / (collected + outstanding) : 0
  const sel = rows.find((r) => r.person.id === selected)
  const maxFloor = floors.length // ชั้นสุดท้าย = หลังคา
  const clampFloor = (i: number) => Math.max(0, Math.min(maxFloor, i))
  const goFloor = (i: number) => setFocus(clampFloor(i))
  const stepFloor = (d: number) => setFocus((f) => clampFloor(f + d))
  const pick = (id: string) => {
    setSelected(id || null)
    const i = rows.findIndex((r) => r.person.id === id)
    if (i >= 0) goFloor(i)
  }

  return (
    <div className="pt-safe px-4 sm:px-6">
      <div className="flex items-center gap-3 pt-2">
        <RoundButton label="กลับ" onClick={() => navigate(-1)}>
          <BackIcon />
        </RoundButton>
        <div>
          <h1 className="text-2xl font-bold">🏯 เรือนน้ำชา</h1>
          <p className="text-sm text-muted">
            {floors.length} ห้อง · เลยกำหนด {floors.filter((f) => f.overdue).length} ห้อง
          </p>
        </div>
      </div>

      {/* ทางลัดไปแต่ละชั้น */}
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        {rows.map((r, i) => (
          <button
            key={r.person.id}
            type="button"
            onClick={() => pick(r.person.id)}
            className={cx(
              'flex shrink-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-sm font-semibold',
              selected === r.person.id ? 'bg-brand-600 text-white' : 'bg-surface',
            )}
          >
            <Avatar name={r.person.aka} avatar={r.person.avatar} size="xs" />
            {i + 1}. {r.person.aka}
            {r.stats.lateHours >= 1 && <span className="size-2 rounded-full bg-danger" />}
          </button>
        ))}
        <button type="button" onClick={() => goFloor(maxFloor)} className="shrink-0 rounded-full bg-surface px-3 py-1 text-sm font-semibold">
          🏯 หลังคา
        </button>
      </div>

      {/* ตัวตึก */}
      <div className="relative mt-3 h-[62dvh] min-h-[360px] overflow-hidden rounded-3xl bg-[#cfe6e3]" style={{ touchAction: 'none' }}>
        {floors.length === 0 ? (
          <div className="grid h-full place-items-center text-[#2f3a44]">ยังไม่มีผู้ยืม เรือนยังว่าง 🏯</div>
        ) : (
          <Suspense fallback={<div className="grid h-full place-items-center text-[#2f3a44]">กำลังพายเรือไปที่เรือน… ⛵</div>}>
            <Building
              floors={floors}
              selectedId={selected}
              focusY={BASE + focus * FLOOR_H + 0.6}
              onBoat={() => navigate('/?tab=slips')}
              onPick={pick}
              total={fmtBaht(outstanding)}
              rate={rate}
            />
          </Suspense>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button type="button" onClick={() => stepFloor(1)} className="grid size-11 place-items-center rounded-full bg-white/90 text-lg font-bold text-[#1a1240]" aria-label="ขึ้นชั้นบน">
            ▲
          </button>
          <span className="tabular rounded-full bg-black/40 py-1 text-center text-xs font-semibold text-white">
            {focus >= maxFloor ? 'หลังคา' : `ชั้น ${focus + 1}`}
          </span>
          <button type="button" onClick={() => stepFloor(-1)} className="grid size-11 place-items-center rounded-full bg-white/90 text-lg font-bold text-[#1a1240]" aria-label="ลงชั้นล่าง">
            ▼
          </button>
        </div>
        <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[11px] text-[#2f3a44]/70 [text-shadow:0_1px_2px_rgb(255_255_255/.6)]">
          ลากเพื่อหมุน · แตะห้องเพื่อดูรายละเอียด
        </p>
      </div>

      {/* สรุปห้องที่เลือก */}
      {sel && (
        <div className="rise-in mt-3 rounded-3xl bg-surface p-4">
          <div className="flex items-center gap-3">
            <Avatar name={sel.person.aka} avatar={sel.person.avatar} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{sel.person.aka}</p>
              <TierChip tier={sel.stats.tier} />
            </div>
            <span className="tabular text-right font-bold">{fmtBaht(sel.balance)}</span>
          </div>
          <p className="mt-2 rounded-2xl bg-canvas px-3 py-2 text-sm">🐱 {catLine(sel.stats, sel.person.aka)}</p>
          <p className="mt-2 text-sm text-muted">
            🍗 อิ่ม {sel.stats.fullness} · 💖 สุข {sel.stats.happiness} · 💪 สุขภาพ {sel.stats.health}
            {sel.pending > 0 && ` · 📩 สลิปรอตรวจ ${sel.pending}`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Pill tone="brand" onClick={() => navigate(`/borrowers/${sel.person.id}`)}>
              ดูรายละเอียด
            </Pill>
            <Pill onClick={() => navigate(`/borrowers/${sel.person.id}/cat`)}>🏠 เข้าบ้านแมว</Pill>
          </div>
        </div>
      )}
    </div>
  )
}

export default CatBuilding
