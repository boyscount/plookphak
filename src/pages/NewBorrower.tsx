import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RoundButton } from '../components/AppShell'
import { BackIcon } from '../components/icons'
import { emptyLoanDraft, LoanFields, parseLoanDraft, writeLoan } from '../components/LoanForm'
import { Card, ErrorText, Field, Input, Pill } from '../components/ui'
import { errorText, supabase } from '../lib/supabase'

/** admin เพิ่มผู้ยืม: สร้างบัญชี + รายการยืมแรกในหน้าเดียว */
export function NewBorrower() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [acc, setAcc] = useState({ aka: '', username: '', password: '' })
  const [withLoan, setWithLoan] = useState(true)
  const [draft, setDraft] = useState(emptyLoanDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    const loan = withLoan ? parseLoanDraft(draft) : null
    if (typeof loan === 'string') return setError(loan)
    setBusy(true)
    try {
      const { data: id, error } = await supabase.rpc('create_account', {
        p_username: acc.username,
        p_password: acc.password,
        p_aka: acc.aka,
        p_role: 'borrower',
      })
      if (error) throw error
      if (loan) await writeLoan({ ...loan, borrower_id: id }, (r) => supabase.from('loans').insert(r))
      qc.invalidateQueries()
      navigate(`/borrowers/${id}`, { replace: true })
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-safe px-4 sm:px-6">
      <div className="flex items-center gap-3 pt-2">
        <RoundButton label="กลับ" onClick={() => navigate(-1)}>
          <BackIcon />
        </RoundButton>
        <h1 className="text-2xl font-bold">เพิ่มผู้ยืม</h1>
      </div>

      <div className="mt-5 space-y-4">
        <Card className="space-y-4">
          <h2 className="text-lg font-bold">บัญชีผู้ยืม</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="ชื่อ AKA">
              <Input value={acc.aka} onChange={(e) => setAcc({ ...acc, aka: e.target.value })} placeholder="เช่น ต้นกล้า" />
            </Field>
            <Field label="ชื่อผู้ใช้ (ล็อกอิน)" hint="a-z 0-9 _ . - อย่างน้อย 3 ตัว">
              <Input
                autoCapitalize="none"
                value={acc.username}
                onChange={(e) => setAcc({ ...acc, username: e.target.value.toLowerCase() })}
                placeholder="tonkla"
              />
            </Field>
            <Field label="รหัสผ่าน" hint="อย่างน้อย 6 ตัว">
              <Input value={acc.password} onChange={(e) => setAcc({ ...acc, password: e.target.value })} autoComplete="new-password" />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4">
          <label className="flex items-center justify-between">
            <h2 className="text-lg font-bold">รายการยืม</h2>
            <span className="flex items-center gap-2 text-sm text-muted">
              เพิ่มตอนนี้
              <input type="checkbox" className="size-5 accent-brand-600" checked={withLoan} onChange={(e) => setWithLoan(e.target.checked)} />
            </span>
          </label>
          {withLoan && <LoanFields draft={draft} onChange={setDraft} />}
        </Card>

        <ErrorText error={error} />
        <Pill tone="brand" className="w-full" disabled={busy} onClick={save}>
          {busy ? 'กำลังบันทึก…' : 'บันทึก'}
        </Pill>
      </div>
    </div>
  )
}
