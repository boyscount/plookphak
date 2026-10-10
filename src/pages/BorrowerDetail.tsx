import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DarkPill, ProfileHeader, RoundButton } from '../components/AppShell'
import { BackIcon, CashIcon, KeyIcon, PlusIcon } from '../components/icons'
import { LoanCard } from '../components/LoanCard'
import { draftFromLoan, emptyLoanDraft, LoanFields, parseLoanDraft, type LoanDraft } from '../components/LoanForm'
import { CashSheet, PaymentList } from '../components/Payments'
import { EmptyState, ErrorText, Field, Input, Pill, Row, Sheet, Spinner, Tabs, Card } from '../components/ui'
import { fmtDateTime } from '../lib/format'
import { loanSnapshot } from '../lib/loanMath'
import { must, useLoans, useProfile, useRefreshMoney } from '../lib/queries'
import { errorText, supabase } from '../lib/supabase'
import type { Loan } from '../lib/types'
import { useQueryClient } from '@tanstack/react-query'

export function BorrowerDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: person } = useProfile(id)
  const { data: loans, isLoading } = useLoans(id)
  const [tab, setTab] = useState<'open' | 'history' | 'info'>('open')
  const [editLoan, setEditLoan] = useState<Loan | 'new' | null>(null)
  const [cashFor, setCashFor] = useState<Loan | null>(null)
  const [editProfile, setEditProfile] = useState(false)
  const [resetPw, setResetPw] = useState(false)

  if (!person) return <Spinner />
  const all = loans ?? []
  const now = Date.now()
  const open = all.filter((l) => {
    const s = loanSnapshot(l, l.payments, now)
    return s.balance > 0 || s.state === 'pending_review'
  })
  const closed = all.filter((l) => !open.includes(l))
  const payments = all.flatMap((l) => l.payments)

  const loanActions = (l: Loan) => (
    <div className="grid grid-cols-3 gap-2">
      <Pill className="!px-3 !text-sm" icon={<CashIcon className="size-5" />} onClick={() => setCashFor(l)}>
        รับเงินสด
      </Pill>
      <Pill className="!px-3 !text-sm" onClick={() => setEditLoan(l)}>
        แก้ไข
      </Pill>
      <DeleteLoan loan={l} />
    </div>
  )

  return (
    <div>
      <ProfileHeader
        name={person.aka}
        subtitle={`@${person.username}${person.active ? '' : ' · ปิดใช้งาน'}`}
        left={
          <RoundButton label="กลับ" onClick={() => navigate(-1)}>
            <BackIcon />
          </RoundButton>
        }
        right={<DarkPill onClick={() => setEditProfile(true)}>แก้ไขโปรไฟล์</DarkPill>}
      />
      <div className="mt-6 grid grid-cols-2 gap-3 px-4 sm:px-6">
        <Pill icon={<PlusIcon className="size-6" />} onClick={() => setEditLoan('new')}>
          เพิ่มรายการยืม
        </Pill>
        <Pill icon={<KeyIcon />} onClick={() => setResetPw(true)}>
          รีเซ็ตรหัสผ่าน
        </Pill>
      </div>

      <div className="mt-6 px-4 sm:px-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'open', label: 'ยอดค้าง', badge: open.length },
            { id: 'history', label: 'ประวัติชำระ', badge: payments.filter((p) => p.status === 'pending').length },
            { id: 'info', label: 'เกี่ยวกับ' },
          ]}
        />
      </div>

      <div className="mt-4 space-y-4 px-4 sm:px-6">
        {isLoading ? (
          <Spinner />
        ) : tab === 'open' ? (
          <>
            {open.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {open.map((l) => (
                  <LoanCard key={l.id} loan={l} actions={loanActions(l)} />
                ))}
              </div>
            ) : (
              <EmptyState title="ไม่มียอดค้าง" subtitle="เงียบจังเลย…เงียบไปแล้ว…" />
            )}
            {closed.length > 0 && (
              <details className="rounded-3xl bg-white p-4">
                <summary className="cursor-pointer font-semibold">รายการที่ปิดแล้ว ({closed.length})</summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {closed.map((l) => (
                    <LoanCard key={l.id} loan={l} live={false} actions={loanActions(l)} />
                  ))}
                </div>
              </details>
            )}
          </>
        ) : tab === 'history' ? (
          payments.length ? <PaymentList payments={payments} /> : <EmptyState title="ยังไม่มีการชำระ" />
        ) : (
          <Card>
            <Row label="AKA" value={person.aka} />
            <Row label="ชื่อผู้ใช้" value={person.username} />
            <Row label="สร้างเมื่อ" value={fmtDateTime(person.created_at)} />
            <Row label="สถานะ" value={person.active ? 'ใช้งาน' : 'ปิดใช้งาน'} />
            {person.note && <p className="mt-2 text-muted">📝 {person.note}</p>}
            <ToggleActive id={person.id} active={person.active} />
          </Card>
        )}
      </div>

      {editLoan && (
        <LoanSheet borrowerId={person.id} loan={editLoan === 'new' ? null : editLoan} onClose={() => setEditLoan(null)} />
      )}
      {cashFor && <CashSheet loan={cashFor} open onClose={() => setCashFor(null)} />}
      {editProfile && <ProfileSheet id={person.id} aka={person.aka} note={person.note} onClose={() => setEditProfile(false)} />}
      {resetPw && <PasswordSheet userId={person.id} onClose={() => setResetPw(false)} />}
    </div>
  )
}

function DeleteLoan({ loan }: { loan: Loan }) {
  const refresh = useRefreshMoney()
  return (
    <Pill
      className="!px-3 !text-sm !text-danger"
      onClick={async () => {
        if (!confirm('ลบรายการยืมนี้และประวัติการชำระทั้งหมด?')) return
        try {
          await must(supabase.from('loans').delete().eq('id', loan.id))
          refresh()
        } catch (e) {
          alert(errorText(e))
        }
      }}
    >
      ลบ
    </Pill>
  )
}

function LoanSheet({ borrowerId, loan, onClose }: { borrowerId: string; loan: Loan | null; onClose: () => void }) {
  const refresh = useRefreshMoney()
  const [draft, setDraft] = useState<LoanDraft>(() => (loan ? draftFromLoan(loan) : emptyLoanDraft()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const parsed = parseLoanDraft(draft)
    if (typeof parsed === 'string') return setError(parsed)
    setBusy(true)
    try {
      if (loan) await must(supabase.from('loans').update(parsed).eq('id', loan.id))
      else await must(supabase.from('loans').insert({ ...parsed, borrower_id: borrowerId }))
      refresh()
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title={loan ? 'แก้ไขรายการยืม' : 'เพิ่มรายการยืม'}>
      <div className="space-y-4">
        <LoanFields draft={draft} onChange={setDraft} />
        <ErrorText error={error} />
        <Pill tone="brand" className="w-full" disabled={busy} onClick={save}>
          บันทึก
        </Pill>
      </div>
    </Sheet>
  )
}

function ProfileSheet({ id, aka, note, onClose }: { id: string; aka: string; note: string | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [v, setV] = useState({ aka, note: note ?? '' })
  const [error, setError] = useState<string | null>(null)
  async function save() {
    try {
      await must(supabase.from('profiles').update({ aka: v.aka.trim(), note: v.note.trim() || null }).eq('id', id))
      qc.invalidateQueries()
      onClose()
    } catch (e) {
      setError(errorText(e))
    }
  }
  return (
    <Sheet open onClose={onClose} title="แก้ไขโปรไฟล์">
      <div className="space-y-4">
        <Field label="ชื่อ AKA">
          <Input value={v.aka} onChange={(e) => setV({ ...v, aka: e.target.value })} />
        </Field>
        <Field label="หมายเหตุ (ผู้ยืมเห็นด้วย)">
          <Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
        </Field>
        <ErrorText error={error} />
        <Pill tone="brand" className="w-full" onClick={save}>
          บันทึก
        </Pill>
      </div>
    </Sheet>
  )
}

export function PasswordSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  async function save() {
    const { error } = await supabase.rpc('set_password', { p_user: userId, p_password: pw })
    if (error) setError(errorText(error))
    else setDone(true)
  }
  return (
    <Sheet open onClose={onClose} title="รีเซ็ตรหัสผ่าน">
      {done ? (
        <div className="space-y-4 text-center">
          <p className="py-4">ตั้งรหัสผ่านใหม่แล้ว ส่งให้ผู้ใช้ทางแชต</p>
          <Pill tone="brand" className="w-full" onClick={onClose}>
            ตกลง
          </Pill>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 6 ตัว">
            <Input value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </Field>
          <ErrorText error={error} />
          <Pill tone="brand" className="w-full" onClick={save}>
            บันทึก
          </Pill>
        </div>
      )}
    </Sheet>
  )
}

export function ToggleActive({ id, active }: { id: string; active: boolean }) {
  const qc = useQueryClient()
  return (
    <Pill
      className="mt-4 w-full"
      tone={active ? 'gray' : 'ok'}
      onClick={async () => {
        if (active && !confirm('ปิดใช้งานบัญชีนี้? ผู้ใช้จะล็อกอินไม่ได้')) return
        const { error } = await supabase.rpc('set_account_active', { p_user: id, p_active: !active })
        if (error) alert(errorText(error))
        qc.invalidateQueries()
      }}
    >
      {active ? 'ปิดใช้งานบัญชี' : 'เปิดใช้งานบัญชี'}
    </Pill>
  )
}
