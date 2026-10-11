import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ProfileHeader, RoundButton } from '../components/AppShell'
import { openPalette } from '../components/CommandPalette'
import { RequestReviewList } from '../components/BorrowerTools'
import { GoldCard } from '../components/GoldCard'
import { StateBadge } from '../components/LoanCard'
import { AvatarArt, avatarById } from '../components/avatars'
import { Avatar, Card, cx, EmptyState, Input, Pill, Tabs } from '../components/ui'
import { PlusIcon } from '../components/icons'
import { CountUpBaht, MONEY_COLORS, ProgressRing, RankBars, StackedBar } from '../components/charts'
import { useAuth } from '../lib/auth'
import { memberStats, tierOf, type Tier } from '../lib/tier'
import { fmtBaht, fmtDateTime } from '../lib/format'
import { dailyPlan, loanSnapshot, type LoanState } from '../lib/loanMath'
import { useLoanRequests, useLoans, useNow, useProfiles } from '../lib/queries'
import { roleLabel, type Loan, type Profile } from '../lib/types'
import { RowsSkeleton, TilesSkeleton } from '../components/Skeleton'
import { SlipQueue } from '../components/SlipQueue'

const severity: Record<LoanState, number> = { overdue: 0, grace: 1, pending_review: 2, not_due: 3, paid: 4 }

function useBorrowerRows() {
  const { data: loans, isLoading: l1 } = useLoans()
  const { data: people, isLoading: l2 } = useProfiles('borrower')
  const now = useNow(1000)
  const rows = (people ?? []).map((p) => {
    const mine = (loans ?? []).filter((l) => l.borrower_id === p.id)
    const snaps = mine.map((l) => loanSnapshot(l, l.payments, now))
    const balance = snaps.reduce((s, x) => s + x.balance, 0)
    const worst = snaps.map((s) => s.state).sort((a, b) => severity[a] - severity[b])[0] as LoanState | undefined
    const open = mine.filter((_, i) => snaps[i].balance > 0)
    const openSnaps = snaps.filter((x) => x.balance > 0)
    // รอบถัดไป: แบบรายวันคือตัดรอบดอกถัดไป แบบพร้อมต้นคือวันครบชำระ
    const nextDue = open
      .map((l, i) => (openSnaps[i].daily && openSnaps[i].nextDue ? new Date(openSnaps[i].nextDue!.at).toISOString() : l.due_at))
      .sort()[0]
    const modes = [...new Set((open.length ? open : mine).map((l) => l.interest_mode ?? 'with_principal'))]
    const total = openSnaps.reduce((s, x) => s + x.total, 0)
    const paidRatio = total > 0 ? (total - openSnaps.reduce((s, x) => s + x.balance, 0)) / total : mine.length ? 1 : 0
    // แบบรายวัน: นับวันที่ค้างดอก · แบบพร้อมต้น: เลยกำหนดหรือยัง
    const overdueDays = open.reduce(
      (n, l, i) => n + (openSnaps[i].daily ? dailyPlan(l, l.payments, now).days.filter((d) => d.overdue).length : 0),
      0,
    )
    const principalLate = openSnaps.some((x) => !x.daily && (x.state === 'overdue' || x.state === 'grace'))
    return {
      person: p,
      loans: mine,
      balance,
      worst,
      nextDue,
      modes,
      paidRatio,
      overdueDays,
      principalLate,
      tier: tierOf(memberStats(mine, now)),
      pending: mine.flatMap((l) => l.payments).filter((x) => x.status === 'pending').length,
    }
  })
  rows.sort((a, b) => severity[a.worst ?? 'paid'] - severity[b.worst ?? 'paid'] || b.balance - a.balance)
  return { rows, loans: loans ?? [], isLoading: l1 || l2, now }
}

function Stat({ label, value, tone, onClick }: { label: string; value: React.ReactNode; tone?: string; onClick?: () => void }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className={`tabular mt-1 text-2xl font-bold ${tone ?? ''}`}>{value}</p>
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className="rise-in rounded-3xl bg-surface p-4 text-left active:scale-[.98]">
      {body}
    </button>
  ) : (
    <Card className="rise-in !p-4">{body}</Card>
  )
}

export function BorrowerRow({ r }: { r: ReturnType<typeof useBorrowerRows>['rows'][number] }) {
  return (
    <Link to={`/borrowers/${r.person.id}`} className="flex min-w-0 items-center gap-3 rounded-2xl bg-surface p-3.5 active:bg-pill">
      <Avatar name={r.person.aka} avatar={r.person.avatar} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold">
            {r.person.aka} {!r.person.active && <span className="text-xs text-muted">(ปิดใช้งาน)</span>}
          </span>
          <span className="tabular shrink-0 font-bold">{fmtBaht(r.balance)}</span>
        </span>
        <span className="block truncate text-sm text-muted">
          @{r.person.username}
          {r.nextDue && ` · ครบ ${fmtDateTime(r.nextDue)}`}
        </span>
        <span className="mt-1 flex flex-wrap gap-1">
          {r.modes.map((m) => (
            <ModeChip key={m} mode={m} />
          ))}
          {r.worst && <StateBadge state={r.worst} />}
        </span>
      </span>
    </Link>
  )
}

export function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { rows, loans, isLoading, now } = useBorrowerRows()
  type DashTab = 'attention' | 'slips' | 'requests' | 'all'
  // เปิดแท็บตามลิงก์ได้ เช่น /?tab=slips (จากเรือที่เทียบท่าในเรือนน้ำชา)
  const [params] = useSearchParams()
  const asked = params.get('tab')
  const [tab, setTab] = useState<DashTab>(
    asked === 'slips' || asked === 'requests' || asked === 'all' ? asked : 'attention',
  )
  const { data: requests } = useLoanRequests()
  const pendingRequests = requests?.filter((r) => r.status === 'pending').length ?? 0

  const snaps = loans.map((l: Loan) => loanSnapshot(l, l.payments, now))
  const outstanding = snaps.reduce((s, x) => s + x.balance, 0)
  const collected = loans.flatMap((l) => l.payments).filter((p) => p.status === 'approved').reduce((s, p) => s + Number(p.amount), 0)
  const rate = collected + outstanding > 0 ? collected / (collected + outstanding) : 0
  const openLoans = snaps.filter((x) => x.balance > 0).length
  // ยอดรวมแยกประเภทของรายการที่ยังเปิดอยู่ (ก่อนหักที่จ่ายแล้ว)
  const breakdown = loans.reduce(
    (acc, l, i) =>
      snaps[i].balance > 0
        ? { principal: acc.principal + Number(l.principal), interest: acc.interest + snaps[i].interest, penalty: acc.penalty + snaps[i].penalty }
        : acc,
    { principal: 0, interest: 0, penalty: 0 },
  )
  const top = rows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5)
  const overdue = snaps.filter((s) => s.state === 'overdue').length
  const pending = loans.flatMap((l) =>
    l.payments.filter((p) => p.status === 'pending').map((p) => ({ ...p, aka: l.borrower.aka })),
  )
  const attention = rows.filter((r) => r.worst && r.worst !== 'paid' && r.worst !== 'not_due')

  return (
    <div>
      <ProfileHeader
        name={profile?.aka ?? ''}
        avatar={profile?.avatar}
        cover={profile?.cover}
        subtitle={roleLabel[profile?.role ?? 'admin']}
        right={
          <RoundButton label="ค้นหาด่วน (Ctrl+K)" onClick={openPalette}>
            <span className="text-xl">🔍</span>
          </RoundButton>
        }
      />
      <div className="mt-6 space-y-3 px-4 sm:px-6">
        <div className="grid items-center gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
        <GoldCard
          name={profile?.aka ?? ''}
          seed={profile?.id ?? ''}
          variant={profile?.role === 'super_admin' ? 'black' : 'gold'}
          tier={profile?.role === 'super_admin' ? 'BLACK · SUPER ADMIN' : 'GOLD · ADMIN'}
          caption={fmtBaht(outstanding)}
        />
        {/* ฮีโร่: ยอดค้างรับ + อัตราเก็บเงิน */}
        <div className="rise-in relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#4b22a8] via-[#6a32e0] to-[#9a5cff] p-5 text-white shadow-[0_12px_30px_-12px_#5a2fb8]">
          <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-16 left-10 size-40 rounded-full bg-white/5" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-white/80">ยอดค้างรับทั้งหมด</p>
              <CountUpBaht value={outstanding} className="block text-4xl font-bold sm:text-5xl" />
              <p className="mt-2 text-sm text-white/80">
                เก็บแล้ว <b className="tabular text-white">{fmtBaht(collected)}</b> · {openLoans} รายการเปิดอยู่
              </p>
            </div>
            <ProgressRing value={rate} color="#ffffff" track="rgba(255,255,255,.22)" label={`${Math.round(rate * 100)}%`} sub={<span className="text-white/75">เก็บได้</span>} />
          </div>
        </div>

        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="เงินต้นที่ปล่อยอยู่" value={<CountUpBaht value={breakdown.principal} />} />
          <Stat label="ดอก + ค่าปรับสะสม" value={<CountUpBaht value={breakdown.interest + breakdown.penalty} />} />
          <Stat label="เลยกำหนด" value={`${overdue} คน`} tone={overdue ? 'text-danger' : ''} onClick={() => setTab('attention')} />
          <Stat label="สลิปรอตรวจ" value={`${pending.length} ใบ`} tone={pending.length ? 'text-brand-700' : ''} onClick={() => setTab('slips')} />
        </div>

        <div className="grid gap-3">
          <Card className="rise-in">
            <h3 className="font-bold">ยอดรวมแยกประเภท</h3>
            <p className="mb-4 text-sm text-muted">ของรายการที่ยังเปิดอยู่ ก่อนหักที่จ่ายแล้ว</p>
            <StackedBar
              segments={[
                { key: 'p', label: 'เงินต้น', value: breakdown.principal, color: MONEY_COLORS.principal },
                { key: 'i', label: 'ดอกเบี้ย', value: breakdown.interest, color: MONEY_COLORS.interest },
                { key: 'f', label: 'ค่าปรับ', value: breakdown.penalty, color: MONEY_COLORS.penalty },
              ]}
            />
          </Card>
        </div>

        {top.length > 0 && (
          <Card className="rise-in">
            <h3 className="mb-3 font-bold">ค้างมากที่สุด</h3>
            <RankBars
              rows={top.map((r) => ({
                key: r.person.id,
                value: r.balance,
                label: (
                  <span className="flex items-center gap-2">
                    <Avatar name={r.person.aka} avatar={r.person.avatar} size="xs" />
                    {r.person.aka}
                  </span>
                ),
              }))}
              onPick={(id) => navigate(`/borrowers/${id}`)}
            />
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Pill onClick={() => navigate('/building')}>🏯 เรือนน้ำชา</Pill>
          <Pill icon={<PlusIcon className="size-6" />} onClick={() => navigate('/borrowers/new')}>
            เพิ่มผู้ยืม
          </Pill>
        </div>
      </div>

      <div className="mt-6 px-4 sm:px-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'attention', label: 'ต้องติดตาม', badge: attention.length },
            { id: 'slips', label: 'สลิปรอตรวจ', badge: pending.length },
            { id: 'requests', label: 'คำขอ', badge: pendingRequests },
            { id: 'all', label: 'ผู้ยืมทั้งหมด' },
          ]}
        />
      </div>
      <div className="mt-4 px-4 sm:px-6">
        {isLoading ? (
          tab === 'slips' ? <RowsSkeleton count={3} /> : <TilesSkeleton />
        ) : tab === 'slips' ? (
          pending.length ? <SlipQueue payments={pending} /> : <EmptyState title="ไม่มีสลิปรอตรวจ" />
        ) : tab === 'requests' ? (
          <RequestReviewList names={Object.fromEntries(rows.map((r) => [r.person.id, r.person.aka]))} />
        ) : (
          <BorrowerList rows={tab === 'all' ? rows : attention} empty={tab === 'all' ? 'ยังไม่มีผู้ยืม' : 'ไม่มีใครต้องติดตาม'} />
        )}
      </div>
    </div>
  )
}

type Row = ReturnType<typeof useBorrowerRows>['rows'][number]
type View = 'list' | 'grid'
const VIEW_KEY = 'plookphak:borrower-view'

/** มุมมองที่เลือกไว้ จำเฉพาะเครื่องนี้ */
function readView(): View {
  try {
    // ค่าเริ่มต้นเป็นแบบการ์ด — เป็นรายการก็ต่อเมื่อเคยเลือกไว้
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export function ModeChip({ mode, solid }: { mode: string; solid?: boolean }) {
  const daily = mode === 'daily'
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap',
        solid
          ? daily
            ? 'bg-brand-600 text-white'
            : 'bg-[#e9b949] text-[#3d2c08]'
          : daily
            ? 'bg-brand-50 text-brand-700'
            : 'bg-amber-100 text-amber-800',
      )}
    >
      {daily ? '📅 รายวัน' : '💰 พร้อมต้น'}
    </span>
  )
}

const shortDate = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })

const TIER_ICON: Record<Tier, string> = { platinum: '💎', gold: '⭐', silver: '🥈' }

/**
 * การ์ดสะสมแบบชั้นหนังสือ: ปกเป็นรูปแมว ป้ายรูปแบบดอก ป้ายค้าง แถบความคืบหน้า
 * เอียง 3D ตามนิ้ว/เมาส์ มีแสงสะท้อนตามจุดที่ชี้ และผิวฟอยล์ตามระดับบัตร
 */
function BorrowerTile({ r, index }: { r: Row; index: number }) {
  const a = avatarById(r.person.avatar)
  const late = r.overdueDays > 0 || r.principalLate
  const pct = Math.round(r.paidRatio * 100)
  const card = useRef<HTMLDivElement>(null)

  const onMove = (e: React.PointerEvent) => {
    const el = card.current
    if (!el) return
    const b = el.getBoundingClientRect()
    const x = (e.clientX - b.left) / b.width
    const y = (e.clientY - b.top) / b.height
    el.style.setProperty('--rx', `${(0.5 - y) * 16}deg`)
    el.style.setProperty('--ry', `${(x - 0.5) * 18}deg`)
    el.style.setProperty('--mx', `${x * 100}%`)
    el.style.setProperty('--my', `${y * 100}%`)
    el.style.setProperty('--glare', '1')
  }
  const onLeave = () => {
    const el = card.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--glare', '0')
  }

  return (
    <Link
      to={`/borrowers/${r.person.id}`}
      className="tile-in group block min-w-0 [perspective:800px]"
      style={{ animationDelay: `${Math.min(index, 12) * 60}ms` }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerUp={onLeave}
    >
      <div
        ref={card}
        className={cx('tile-card relative aspect-[3/4] overflow-hidden rounded-2xl', late && 'tile-late')}
        style={{ background: `radial-gradient(120% 80% at 50% 30%, #ffffff66, transparent 60%), ${a.bg}` }}
      >
        <AvatarArt id={r.person.avatar} className="tile-art absolute inset-x-[12%] top-[8%] w-[76%] drop-shadow-lg" />
        {/* ฟอยล์ตามระดับ + แสงสะท้อนตามนิ้ว */}
        <div className={`tile-foil tile-foil-${r.tier}`} />
        <div className="tile-glare" />
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {r.modes.map((m) => (
            <ModeChip key={m} mode={m} solid />
          ))}
        </div>
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <span className="grid size-7 place-items-center rounded-full bg-black/25 text-sm backdrop-blur-sm" title={r.tier}>
            {TIER_ICON[r.tier]}
          </span>
          {r.pending > 0 && <span className="rounded-full bg-sky-500 px-2 py-0.5 text-xs font-bold text-white">📩 {r.pending}</span>}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pt-10 pb-2.5 text-white">
          {(late || r.balance <= 0) && (
            <div className="mb-1.5 flex justify-end">
              {late ? (
                <span className="rounded-lg bg-[#ff8a1f] px-2 py-0.5 text-xs font-bold">
                  {r.overdueDays > 0 ? `ค้าง ${r.overdueDays} วัน` : 'เลยกำหนด'}
                </span>
              ) : (
                <span className="rounded-lg bg-ok px-2 py-0.5 text-xs font-bold text-on-status">จ่ายครบ</span>
              )}
            </div>
          )}
          <span className="tabular block text-2xl leading-none font-bold whitespace-nowrap">
            {pct}
            <span className="ml-0.5 text-xs font-semibold opacity-85">% จ่ายแล้ว</span>
          </span>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/30">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 leading-snug font-semibold">{r.person.aka}</p>
      <p className="text-sm">
        <span className="tabular font-semibold">{fmtBaht(r.balance)}</span>
        {r.nextDue && r.balance > 0 && (
          <span className={late ? 'text-danger' : 'text-[#e0457b]'}> · ถัดไป {shortDate.format(new Date(r.nextDue))}</span>
        )}
      </p>
    </Link>
  )
}

const VIEWS: { id: View; icon: string; label: string }[] = [
  { id: 'list', icon: '☰', label: 'แบบรายการ' },
  { id: 'grid', icon: '▦', label: 'แบบการ์ด' },
]

function BorrowerList({ rows, empty }: { rows: Row[]; empty: string }) {
  const [view, setView] = useState<View>(readView)
  const pick = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // จำไม่ได้ก็ใช้ได้แค่รอบนี้
    }
  }
  if (!rows.length) return <EmptyState title={empty} subtitle="เงียบจังเลย…เงียบไปแล้ว…" />
  const daily = rows.filter((r) => r.modes.includes('daily')).length
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {rows.length} คน · 📅 รายวัน {daily} · 💰 พร้อมต้น {rows.length - daily}
        </p>
        <div className="flex shrink-0 gap-1 rounded-full bg-pill p-1" role="radiogroup" aria-label="มุมมอง">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={view === v.id}
              aria-label={v.label}
              onClick={() => pick(v.id)}
              className={cx('grid size-9 place-items-center rounded-full text-lg', view === v.id ? 'bg-surface text-brand-700 shadow' : 'text-muted')}
            >
              {v.icon}
            </button>
          ))}
        </div>
      </div>
      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r, i) => (
            <BorrowerTile key={r.person.id} r={r} index={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((r) => (
            <BorrowerRow key={r.person.id} r={r} />
          ))}
        </div>
      )}
    </div>
  )
}

/** เมนู "เรียกดู" ของ admin: ค้นหาผู้ยืม */
export function Browse() {
  const { rows, isLoading } = useBorrowerRows()
  const [q, setQ] = useState('')
  const filtered = rows.filter((r: { person: Profile }) =>
    `${r.person.aka} ${r.person.username}`.toLowerCase().includes(q.trim().toLowerCase()),
  )
  return (
    <div className="pt-safe px-4 sm:px-6">
      <h1 className="pt-4 text-3xl font-bold">เรียกดู</h1>
      <Input className="mt-4" placeholder="ค้นหาชื่อ / AKA / username" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4">{isLoading ? <TilesSkeleton /> : <BorrowerList rows={filtered} empty="ไม่พบผู้ยืม" />}</div>
    </div>
  )
}
