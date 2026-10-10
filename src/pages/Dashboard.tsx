import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProfileHeader } from '../components/AppShell'
import { StateBadge } from '../components/LoanCard'
import { PaymentList } from '../components/Payments'
import { Avatar, Card, EmptyState, Input, Pill, Spinner, Tabs } from '../components/ui'
import { PlusIcon } from '../components/icons'
import { useAuth } from '../lib/auth'
import { fmtBaht, fmtDateTime } from '../lib/format'
import { loanSnapshot, type LoanState } from '../lib/loanMath'
import { useLoans, useNow, useProfiles } from '../lib/queries'
import { roleLabel, type Loan, type Profile } from '../lib/types'

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
    const nextDue = mine
      .filter((_, i) => snaps[i].balance > 0)
      .map((l) => l.due_at)
      .sort()[0]
    return { person: p, loans: mine, balance, worst, nextDue, pending: mine.flatMap((l) => l.payments).filter((x) => x.status === 'pending').length }
  })
  rows.sort((a, b) => severity[a.worst ?? 'paid'] - severity[b.worst ?? 'paid'] || b.balance - a.balance)
  return { rows, loans: loans ?? [], isLoading: l1 || l2, now }
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="!p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`tabular mt-1 text-2xl font-bold ${tone ?? ''}`}>{value}</p>
    </Card>
  )
}

export function BorrowerRow({ r }: { r: ReturnType<typeof useBorrowerRows>['rows'][number] }) {
  return (
    <Link to={`/borrowers/${r.person.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 active:bg-pill">
      <Avatar name={r.person.aka} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {r.person.aka} {!r.person.active && <span className="text-xs text-muted">(ปิดใช้งาน)</span>}
        </span>
        <span className="block truncate text-sm text-muted">
          @{r.person.username}
          {r.nextDue && ` · ครบ ${fmtDateTime(r.nextDue)}`}
        </span>
      </span>
      <span className="text-right">
        <span className="tabular block font-bold">{fmtBaht(r.balance)}</span>
        {r.worst && <StateBadge state={r.worst} />}
      </span>
    </Link>
  )
}

export function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { rows, loans, isLoading, now } = useBorrowerRows()
  const [tab, setTab] = useState<'attention' | 'slips' | 'all'>('attention')

  const snaps = loans.map((l: Loan) => loanSnapshot(l, l.payments, now))
  const outstanding = snaps.reduce((s, x) => s + x.balance, 0)
  const lent = loans.filter((_, i) => snaps[i].balance > 0).reduce((s, l) => s + Number(l.principal), 0)
  const penalty = snaps.filter((s) => s.balance > 0).reduce((s, x) => s + x.penalty + x.interest, 0)
  const overdue = snaps.filter((s) => s.state === 'overdue').length
  const pending = loans.flatMap((l) =>
    l.payments.filter((p) => p.status === 'pending').map((p) => ({ ...p, aka: l.borrower.aka })),
  )
  const attention = rows.filter((r) => r.worst && r.worst !== 'paid' && r.worst !== 'not_due')

  return (
    <div>
      <ProfileHeader name={profile?.aka ?? ''} subtitle={roleLabel[profile?.role ?? 'admin']} />
      <div className="mt-6 grid grid-cols-2 gap-3 px-4 sm:px-6 lg:grid-cols-4">
        <Stat label="ยอดค้างรับทั้งหมด" value={fmtBaht(outstanding)} />
        <Stat label="เงินต้นที่ยังไม่คืน" value={fmtBaht(lent)} />
        <Stat label="ดอก + ค่าปรับสะสม" value={fmtBaht(penalty)} />
        <Stat label="เลยกำหนด / สลิปรอตรวจ" value={`${overdue} / ${pending.length}`} tone={overdue ? 'text-danger' : ''} />
      </div>
      <div className="mt-3 px-4 sm:px-6">
        <Pill icon={<PlusIcon className="size-6" />} className="w-full" onClick={() => navigate('/borrowers/new')}>
          เพิ่มผู้ยืม
        </Pill>
      </div>

      <div className="mt-6 px-4 sm:px-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'attention', label: 'ต้องติดตาม', badge: attention.length },
            { id: 'slips', label: 'สลิปรอตรวจ', badge: pending.length },
            { id: 'all', label: 'ผู้ยืมทั้งหมด' },
          ]}
        />
      </div>
      <div className="mt-4 px-4 sm:px-6">
        {isLoading ? (
          <Spinner />
        ) : tab === 'slips' ? (
          pending.length ? <PaymentList payments={pending} /> : <EmptyState title="ไม่มีสลิปรอตรวจ" />
        ) : (
          <BorrowerList rows={tab === 'all' ? rows : attention} empty={tab === 'all' ? 'ยังไม่มีผู้ยืม' : 'ไม่มีใครต้องติดตาม'} />
        )}
      </div>
    </div>
  )
}

function BorrowerList({ rows, empty }: { rows: ReturnType<typeof useBorrowerRows>['rows']; empty: string }) {
  if (!rows.length) return <EmptyState title={empty} subtitle="เงียบจังเลย…เงียบไปแล้ว…" />
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {rows.map((r) => (
        <BorrowerRow key={r.person.id} r={r} />
      ))}
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
      <div className="mt-4">{isLoading ? <Spinner /> : <BorrowerList rows={filtered} empty="ไม่พบผู้ยืม" />}</div>
    </div>
  )
}
