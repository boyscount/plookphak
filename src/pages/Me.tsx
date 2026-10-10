import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ProfileHeader, RoundButton } from '../components/AppShell'
import { GearIcon, KeyIcon, LogoutIcon, ShieldIcon } from '../components/icons'
import { Avatar, Card, EmptyState, ErrorText, Field, Input, Pill, Sheet, Spinner, Tabs } from '../components/ui'
import { useAuth } from '../lib/auth'
import { fmtDateTime } from '../lib/format'
import { must, useProfiles, useSettings } from '../lib/queries'
import { errorText, supabase } from '../lib/supabase'
import { roleLabel } from '../lib/types'
import { PasswordSheet, ToggleActive } from './BorrowerDetail'

export function Me() {
  const { profile, isSuper } = useAuth()
  const [pwOpen, setPwOpen] = useState(false)
  const [tab, setTab] = useState<'admins' | 'audit'>('admins')

  return (
    <div>
      <ProfileHeader
        name={profile?.aka ?? ''}
        subtitle={`@${profile?.username} · ${roleLabel[profile?.role ?? 'borrower']}`}
        left={
          <RoundButton label="ตั้งค่า" onClick={() => setPwOpen(true)}>
            <GearIcon />
          </RoundButton>
        }
      />
      <div className="mt-6 grid grid-cols-2 gap-3 px-4 sm:px-6">
        <Pill icon={<KeyIcon />} onClick={() => setPwOpen(true)}>
          เปลี่ยนรหัสผ่าน
        </Pill>
        <Pill icon={<LogoutIcon />} onClick={() => supabase.auth.signOut()}>
          ออกจากระบบ
        </Pill>
      </div>

      {isSuper && (
        <>
          <div className="mt-6 px-4 sm:px-6">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'admins', label: 'จัดการ admin' },
                { id: 'audit', label: 'บันทึกระบบ' },
              ]}
            />
          </div>
          <div className="mt-4 px-4 sm:px-6">{tab === 'admins' ? <AdminManager /> : <AuditLog />}</div>
        </>
      )}

      {pwOpen && <OwnPasswordSheet onClose={() => setPwOpen(false)} />}
    </div>
  )
}

function OwnPasswordSheet({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function save() {
    if (pw.length < 6) return setError('รหัสผ่านต้องยาวอย่างน้อย 6 ตัว')
    if (pw !== pw2) return setError('รหัสผ่านไม่ตรงกัน')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) setError(errorText(error))
    else setMsg('เปลี่ยนรหัสผ่านแล้ว')
  }
  return (
    <Sheet open onClose={onClose} title="เปลี่ยนรหัสผ่าน">
      <div className="space-y-4">
        <Field label="รหัสผ่านใหม่">
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="ยืนยันรหัสผ่านใหม่">
          <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </Field>
        <ErrorText error={error} />
        {msg && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-ok">{msg}</p>}
        <Pill tone="brand" className="w-full" onClick={msg ? onClose : save}>
          {msg ? 'ปิด' : 'บันทึก'}
        </Pill>
      </div>
    </Sheet>
  )
}

/** super admin: กำหนดจำนวน admin และสร้าง/ปิด admin */
function AdminManager() {
  const qc = useQueryClient()
  const { data: settings } = useSettings()
  const { data: admins, isLoading } = useProfiles('admin')
  const [form, setForm] = useState({ aka: '', username: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [pwFor, setPwFor] = useState<string | null>(null)
  const activeCount = admins?.filter((a) => a.active).length ?? 0
  const quota = settings?.max_admins ?? 0

  async function setQuota(n: number) {
    try {
      await must(supabase.from('app_settings').update({ max_admins: Math.max(0, n) }).eq('id', 1))
      qc.invalidateQueries({ queryKey: ['settings'] })
    } catch (e) {
      alert(errorText(e))
    }
  }

  async function create() {
    setError(null)
    const { error } = await supabase.rpc('create_account', {
      p_username: form.username,
      p_password: form.password,
      p_aka: form.aka,
      p_role: 'admin',
    })
    if (error) return setError(errorText(error))
    setForm({ aka: '', username: '', password: '' })
    qc.invalidateQueries({ queryKey: ['profiles'] })
  }

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-muted">จำนวน admin สูงสุด</p>
          <p className="text-sm text-muted">ใช้อยู่ {activeCount} คน</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="size-11 rounded-full bg-pill text-xl font-bold" onClick={() => setQuota(quota - 1)} aria-label="ลด">
            −
          </button>
          <span className="tabular w-8 text-center text-2xl font-bold">{quota}</span>
          <button className="size-11 rounded-full bg-pill text-xl font-bold" onClick={() => setQuota(quota + 1)} aria-label="เพิ่ม">
            +
          </button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h3 className="text-lg font-bold">เพิ่ม admin</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="ชื่อ AKA" value={form.aka} onChange={(e) => setForm({ ...form, aka: e.target.value })} />
          <Input
            placeholder="ชื่อผู้ใช้"
            autoCapitalize="none"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
          />
          <Input placeholder="รหัสผ่าน" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <ErrorText error={error} />
        <Pill tone="brand" className="w-full" disabled={activeCount >= quota} onClick={create}>
          {activeCount >= quota ? 'เต็มโควตา — เพิ่มจำนวนก่อน' : 'สร้าง admin'}
        </Pill>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : !admins?.length ? (
        <EmptyState title="ยังไม่มี admin" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {admins.map((a) => (
            <Card key={a.id}>
              <div className="flex items-center gap-3">
                <Avatar name={a.aka} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{a.aka}</p>
                  <p className="text-sm text-muted">
                    @{a.username} · {a.active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                  </p>
                </div>
                <button className="rounded-full bg-pill px-3 py-2 text-sm font-semibold" onClick={() => setPwFor(a.id)}>
                  รีเซ็ตรหัส
                </button>
              </div>
              <ToggleActive id={a.id} active={a.active} />
            </Card>
          ))}
        </div>
      )}
      {pwFor && <PasswordSheet userId={pwFor} onClose={() => setPwFor(null)} />}
    </div>
  )
}

type AuditRow = {
  id: number
  actor: string | null
  action: string
  table_name: string
  new_data: Record<string, unknown> | null
  old_data: Record<string, unknown> | null
  at: string
}

const tableLabel: Record<string, string> = {
  loans: 'รายการยืม',
  payments: 'การชำระ',
  profiles: 'บัญชี',
  app_settings: 'ตั้งค่า',
}
const actionLabel: Record<string, string> = { insert: 'เพิ่ม', update: 'แก้ไข', delete: 'ลบ' }

function AuditLog() {
  const { data: people } = useProfiles()
  const { data, isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: () => must<AuditRow[]>(supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(200)),
  })
  const name = (id: string | null) => (id ? (people?.find((p) => p.id === id)?.aka ?? 'ไม่ทราบ') : 'ระบบ')

  if (isLoading) return <Spinner />
  if (!data?.length) return <EmptyState title="ยังไม่มีบันทึก" />
  return (
    <ul className="space-y-2">
      {data.map((r) => {
        const changed =
          r.action === 'update' && r.old_data && r.new_data
            ? Object.keys(r.new_data).filter(
                (k) => !['updated_at', 'reviewed_at'].includes(k) && JSON.stringify(r.new_data![k]) !== JSON.stringify(r.old_data![k]),
              )
            : []
        return (
          <li key={r.id} className="rounded-2xl bg-white p-3.5">
            <div className="flex items-center gap-2">
              <ShieldIcon className="size-5 text-brand-600" />
              <span className="font-semibold">
                {name(r.actor)} {actionLabel[r.action]}
                {tableLabel[r.table_name] ?? r.table_name}
              </span>
            </div>
            {changed.length > 0 && (
              <p className="mt-1 text-sm break-all text-muted">
                {changed.map((k) => `${k}: ${JSON.stringify(r.old_data![k])} → ${JSON.stringify(r.new_data![k])}`).join(' · ')}
              </p>
            )}
            <p className="mt-0.5 text-xs text-muted">{fmtDateTime(r.at)}</p>
          </li>
        )
      })}
    </ul>
  )
}
