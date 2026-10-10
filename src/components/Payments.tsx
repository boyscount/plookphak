import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { fmtBaht, fmtDateTime, fromLocalInput, toLocalInput } from '../lib/format'
import { loanSnapshot } from '../lib/loanMath'
import { must, signedSlipUrl, uploadSlip, useRefreshMoney } from '../lib/queries'
import { errorText, supabase } from '../lib/supabase'
import type { Loan, Payment } from '../lib/types'
import { cx, ErrorText, Field, Input, Pill, Sheet } from './ui'

const statusText = {
  pending: { t: 'รอตรวจ', c: 'bg-sky-100 text-sky-800' },
  approved: { t: 'ผ่าน', c: 'bg-emerald-100 text-ok' },
  rejected: { t: 'ไม่ผ่าน', c: 'bg-red-100 text-danger' },
}

export function PaymentList({ payments, title }: { payments: (Payment & { aka?: string })[]; title?: string }) {
  const { isStaff } = useAuth()
  const [viewing, setViewing] = useState<Payment | null>(null)
  if (!payments.length) return null
  const sorted = [...payments].sort((a, b) => Date.parse(b.paid_at) - Date.parse(a.paid_at))
  return (
    <div>
      {title && <h3 className="mb-2 px-1 text-lg font-bold">{title}</h3>}
      <ul className="space-y-2">
        {sorted.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => setViewing(p)}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left active:bg-pill"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-50 text-xl">
                {p.method === 'cash' ? '💵' : '🧾'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {p.aka ? `${p.aka} · ` : ''}
                  {fmtBaht(Number(p.amount))}
                </span>
                <span className="block text-sm text-muted">
                  {p.method === 'cash' ? 'เงินสด' : 'โอน'} · {fmtDateTime(p.paid_at)}
                </span>
              </span>
              <span className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', statusText[p.status].c)}>
                {statusText[p.status].t}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {viewing && <PaymentSheet payment={viewing} canReview={isStaff} onClose={() => setViewing(null)} />}
    </div>
  )
}

function PaymentSheet({ payment, canReview, onClose }: { payment: Payment; canReview: boolean; onClose: () => void }) {
  const refresh = useRefreshMoney()
  const [url, setUrl] = useState<string | null>(null)
  const [amount, setAmount] = useState(String(payment.amount))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (payment.slip_path) signedSlipUrl(payment.slip_path).then(setUrl, () => setUrl(null))
  }, [payment.slip_path])

  async function review(status: 'approved' | 'rejected' | 'delete') {
    setBusy(true)
    setError(null)
    try {
      if (status === 'delete') {
        if (!confirm('ลบรายการนี้?')) return
        await must(supabase.from('payments').delete().eq('id', payment.id))
      } else {
        await must(
          supabase
            .from('payments')
            .update({ status, amount: Number(amount), reject_reason: status === 'rejected' ? reason || null : null })
            .eq('id', payment.id),
        )
      }
      refresh()
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title={payment.method === 'cash' ? 'รับเงินสด' : 'สลิปโอนเงิน'}>
      <div className="space-y-4">
        {payment.slip_path &&
          (url ? (
            <a href={url} target="_blank" rel="noreferrer">
              <img src={url} alt="สลิป" className="max-h-[50dvh] w-full rounded-2xl bg-pill object-contain" />
            </a>
          ) : (
            <div className="h-48 animate-pulse rounded-2xl bg-pill" />
          ))}
        <p className="text-muted">
          ส่งเมื่อ {fmtDateTime(payment.paid_at)} · สถานะ <b>{statusText[payment.status].t}</b>
        </p>
        {payment.reject_reason && <p className="text-danger">เหตุผล: {payment.reject_reason}</p>}
        {payment.note && <p className="text-muted">📝 {payment.note}</p>}

        {canReview && (
          <>
            <Field label="ยอดเงิน (แก้ได้ถ้ายอดในสลิปไม่ตรง)">
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="เหตุผลถ้าไม่ผ่าน">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ยอดไม่ตรง / สลิปซ้ำ" />
            </Field>
            <ErrorText error={error} />
            <div className="grid grid-cols-2 gap-2">
              <Pill tone="ok" disabled={busy} onClick={() => review('approved')}>
                ✓ ผ่าน
              </Pill>
              <Pill tone="danger" disabled={busy} onClick={() => review('rejected')}>
                ✕ ไม่ผ่าน
              </Pill>
            </div>
            <button className="w-full py-2 text-sm text-muted underline" disabled={busy} onClick={() => review('delete')}>
              ลบรายการนี้
            </button>
          </>
        )}
      </div>
    </Sheet>
  )
}

/** ผู้ยืม: อัปสลิป แล้วกด "ส่ง" ให้ admin ตรวจ */
export function SlipSheet({ loans, open, onClose }: { loans: Loan[]; open: boolean; onClose: () => void }) {
  const refresh = useRefreshMoney()
  const unpaid = loans.filter((l) => loanSnapshot(l, l.payments, Date.now()).balance > 0)
  const [loanId, setLoanId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const selected = unpaid.find((l) => l.id === loanId) ?? unpaid[0]
  const snap = selected ? loanSnapshot(selected, selected.payments, Date.now()) : null
  const balance = snap?.balance ?? 0
  // แบบรายวัน: ยอดที่ต้องจ่ายตอนนี้ = ที่ค้างอยู่ หรือดอกรอบถัดไป
  const roundAmount = snap?.daily ? (snap.arrearsAmount > 0 ? snap.arrearsAmount : (snap.nextDue?.amount ?? 0)) : 0
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  async function send() {
    if (!selected || !file || !Number(amount)) return setError('เลือกสลิปและใส่ยอดเงินก่อน')
    setBusy(true)
    setError(null)
    try {
      const path = await uploadSlip(selected.id, file)
      await must(
        supabase.from('payments').insert({ loan_id: selected.id, amount: Number(amount), method: 'transfer', slip_path: path }),
      )
      refresh()
      setDone(true)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  function close() {
    setFile(null)
    setAmount('')
    setDone(false)
    setError(null)
    onClose()
  }

  return (
    <Sheet open={open} onClose={close} title="อัปสลิป">
      {done ? (
        <div className="space-y-4 py-6 text-center">
          <div className="text-6xl">✅</div>
          <p className="text-lg font-semibold">ส่งสลิปแล้ว</p>
          <p className="text-muted">ระบบหยุดนับค่าปรับ ณ เวลาที่ส่ง ถ้าสลิปไม่ผ่านการตรวจ ค่าปรับจะนับต่อ</p>
          <Pill tone="brand" className="w-full" onClick={close}>
            ตกลง
          </Pill>
        </div>
      ) : !selected ? (
        <p className="py-6 text-center text-muted">ไม่มียอดค้างชำระ 🎉</p>
      ) : (
        <div className="space-y-4">
          {unpaid.length > 1 && (
            <Field label="รายการที่จะจ่าย">
              <select
                className="h-12 w-full rounded-2xl bg-pill px-4"
                value={selected.id}
                onChange={(e) => setLoanId(e.target.value)}
              >
                {unpaid.map((l) => (
                  <option key={l.id} value={l.id}>
                    {fmtBaht(Number(l.principal))} · ครบ {fmtDateTime(l.due_at)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <label className="block cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {preview ? (
              <img src={preview} alt="ตัวอย่างสลิป" className="max-h-72 w-full rounded-2xl bg-pill object-contain" />
            ) : (
              <span className="flex h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50 text-brand-700">
                <span className="text-4xl">🧾</span>
                <span className="mt-2 font-semibold">แตะเพื่อเลือกรูปสลิป</span>
              </span>
            )}
          </label>
          <Field label="ยอดที่โอน (บาท)" hint={`ยอดคงเหลือทั้งหมด ${fmtBaht(balance)}`}>
            <div className="flex gap-2">
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              {roundAmount > 0 && (
                <button type="button" className="shrink-0 rounded-2xl bg-brand-50 px-3 text-sm font-semibold text-brand-700" onClick={() => setAmount(String(roundAmount))}>
                  {snap!.arrearsAmount > 0 ? 'ยอดค้าง' : 'ดอกรอบนี้'}
                  <span className="block text-xs">{fmtBaht(roundAmount)}</span>
                </button>
              )}
              <button type="button" className="shrink-0 rounded-2xl bg-pill px-4 text-sm font-semibold" onClick={() => setAmount(String(balance))}>
                เต็มยอด
              </button>
            </div>
          </Field>
          <ErrorText error={error} />
          <Pill tone="brand" className="w-full" disabled={busy || !file} onClick={send}>
            {busy ? 'กำลังส่ง…' : 'ส่งให้ผู้ดูแลตรวจ'}
          </Pill>
        </div>
      )}
    </Sheet>
  )
}

/** admin: บันทึกรับเงินสด (หรือโอนที่ได้รับนอกระบบ) */
export function CashSheet({ loan, open, onClose }: { loan: Loan; open: boolean; onClose: () => void }) {
  const refresh = useRefreshMoney()
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(() => toLocalInput(new Date().toISOString()))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const balance = loanSnapshot(loan, loan.payments, Date.parse(fromLocalInput(paidAt))).balance

  async function save() {
    if (!Number(amount)) return setError('ใส่ยอดเงิน')
    setBusy(true)
    setError(null)
    try {
      await must(
        supabase.from('payments').insert({
          loan_id: loan.id,
          amount: Number(amount),
          method: 'cash',
          paid_at: fromLocalInput(paidAt),
          note: note || null,
        }),
      )
      refresh()
      setAmount('')
      setNote('')
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="รับเงินสด">
      <div className="space-y-4">
        <Field label="เวลาที่รับเงิน" hint="ค่าปรับหยุดที่เวลานี้ถ้าจ่ายครบ">
          <Input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </Field>
        <Field label="ยอดที่รับ (บาท)" hint={`ยอดคงเหลือ ณ เวลานั้น ${fmtBaht(balance)}`}>
          <div className="flex gap-2">
            <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button type="button" className="shrink-0 rounded-2xl bg-pill px-4 text-sm font-semibold" onClick={() => setAmount(String(balance))}>
              เต็มยอด
            </button>
          </div>
        </Field>
        <Field label="หมายเหตุ">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <ErrorText error={error} />
        <Pill tone="brand" className="w-full" disabled={busy} onClick={save}>
          บันทึก
        </Pill>
      </div>
    </Sheet>
  )
}
