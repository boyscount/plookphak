// บ้านแมว: ค่าพลังแมวมาจากการจ่ายเงินจริง — โหลดแยกเพราะมี three.js
import { lazy, Suspense, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RoundButton } from '../components/AppShell'
import { TierChip } from '../components/Badges'
import type { CatAction } from '../components/cat3d/Cat'
import { BackIcon } from '../components/icons'
import { SlipSheet } from '../components/Payments'
import { Avatar, cx, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'
import { catLine, catStats } from '../lib/catStats'
import { fmtBaht } from '../lib/format'
import { useLoans, useNow, useProfile } from '../lib/queries'

const CatRoom = lazy(() => import('../components/cat3d/CatRoom'))

const CAT_COLOR: Record<string, string> = {
  cat_finger: '#c9c3d6',
  cat_side_eye: '#ffb347',
  cat_shock: '#2e2a36',
  shiba_derp: '#f2a65a',
  pug_sleepy: '#e8c9a0',
  frog_meh: '#7ccf6b',
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

function StatBar({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-5 text-center">{icon}</span>
      <span className="w-16 shrink-0 text-muted">{label}</span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-pill">
        <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${value}%`, background: color }} />
      </span>
      <span className="tabular w-8 text-right font-semibold">{value}</span>
    </div>
  )
}

export function CatHome() {
  const { id } = useParams()
  const { profile, isStaff } = useAuth()
  const navigate = useNavigate()
  // admin ดูบ้านแมวของผู้ยืม: /borrowers/:id/cat · ผู้ยืมดูของตัวเอง: /cat
  const ownerId = id ?? profile?.id ?? ''
  const { data: owner } = useProfile(ownerId)
  const { data: loans, isLoading } = useLoans(id)
  const now = useNow(30_000)
  const [action, setAction] = useState<CatAction>(null)
  const [payOpen, setPayOpen] = useState(false)
  const webgl = useMemo(hasWebGL, [])

  if (isLoading || !owner) return <Spinner />
  const s = catStats(loans ?? [], now)
  const line = catLine(s, owner.aka)
  const color = CAT_COLOR[owner.avatar ?? ''] ?? '#ffb347'
  const canFeed = !isStaff && s.fullness < 100
  const act = (kind: NonNullable<CatAction>['kind']) => setAction({ kind, at: performance.now() })

  return (
    <div className="pt-safe px-4 sm:px-6">
      <div className="flex items-center gap-3 pt-2">
        {id && (
          <RoundButton label="กลับ" onClick={() => navigate(-1)}>
            <BackIcon />
          </RoundButton>
        )}
        <h1 className="text-2xl font-bold">🏠 บ้านแมว</h1>
      </div>

      {/* การ์ดค่าพลัง */}
      <div className="mt-4 rounded-3xl bg-surface p-4">
        <div className="flex items-center gap-3">
          <Avatar name={owner.aka} avatar={owner.avatar} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">น้องแมวของ {owner.aka}</p>
            <TierChip tier={s.tier} />
          </div>
          {s.owedNow > 0 && (
            <span className="text-right text-sm">
              <span className="block text-muted">ค้างอยู่</span>
              <span className="tabular font-bold text-danger">{fmtBaht(s.owedNow)}</span>
            </span>
          )}
        </div>
        <div className="mt-3 space-y-2">
          <StatBar icon="🍗" label="อิ่ม" value={s.fullness} color="#f59f00" />
          <StatBar icon="💖" label="ความสุข" value={s.happiness} color="#ff6fa0" />
          <StatBar icon="💪" label="สุขภาพ" value={s.health} color="#14a06b" />
        </div>
      </div>

      {/* ฉาก 3D */}
      <div className="relative mt-4 h-[52dvh] min-h-[320px] overflow-hidden rounded-3xl bg-[#efe7ff] sm:h-[58dvh]" style={{ touchAction: 'none' }}>
        {webgl ? (
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-muted">
                <span className="animate-pulse">กำลังเปิดประตูบ้าน… 🐾</span>
              </div>
            }
          >
            <CatRoom color={color} mood={s.mood} fullness={s.fullness} tier={s.tier} line={line} action={action} />
          </Suspense>
        ) : (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <div className="text-6xl">{s.mood === 'sad' ? '😿' : s.mood === 'hungry' ? '🙀' : '😸'}</div>
              <p className="mt-3 font-semibold">{line}</p>
              <p className="mt-1 text-sm text-muted">เครื่องนี้แสดงภาพ 3D ไม่ได้</p>
            </div>
          </div>
        )}
        <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[11px] text-[#6b5a8f]">
          ลากเพื่อหมุนห้อง · บีบเพื่อซูม
        </p>
      </div>

      {/* ปุ่มกิจกรรม */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          {
            icon: '🍗',
            label: isStaff ? 'ให้อาหาร' : canFeed ? 'ให้อาหาร' : 'อิ่มแล้ว',
            hint: isStaff ? 'ผู้ยืมต้องจ่ายเอง' : 'อัปสลิป',
            onClick: () => {
              act('feed')
              if (canFeed) setPayOpen(true)
            },
            disabled: isStaff || !canFeed,
          },
          { icon: '🤚', label: 'ลูบหัว', hint: 'แมวชอบ', onClick: () => act('pet'), disabled: false },
          { icon: '🎾', label: 'เล่นด้วย', hint: 'โยนบอล', onClick: () => act('play'), disabled: false },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={b.onClick}
            disabled={b.disabled}
            className={cx(
              'flex flex-col items-center rounded-2xl bg-surface p-3 transition active:scale-95 disabled:opacity-50',
              !b.disabled && 'shadow-[0_6px_16px_-10px_#7432ea]',
            )}
          >
            <span className="text-3xl">{b.icon}</span>
            <span className="mt-1 text-sm font-semibold">{b.label}</span>
            <span className="text-[11px] text-muted">{b.hint}</span>
          </button>
        ))}
      </div>

      {!isStaff && <SlipSheet loans={loans ?? []} open={payOpen} onClose={() => setPayOpen(false)} />}
    </div>
  )
}

export default CatHome
