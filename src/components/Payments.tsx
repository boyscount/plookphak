import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { fmtBaht, fmtDateTime, fromLocalInput, toLocalInput } from '../lib/format'
import { loanSnapshot } from '../lib/loanMath'
import { must, signedSlipUrl, useLoans, useRefreshMoney } from '../lib/queries'
import { errorText, supabase } from '../lib/supabase'
import type { Loan, Payment } from '../lib/types'
import { DayPicker } from './DayPicker'
import { ReceiptSheet } from './ReceiptSheet'
import { PayoffSummary } from './SlipSheet'
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
              className="flex w-full items-center gap-3 rounded-2xl card-depth p-3.5 text-left active:bg-pill"
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
                  {p.note && <span className="block truncate text-brand-700">{p.note}</span>}
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

export function PaymentSheet({ payment, canReview, onClose }: { payment: Payment; canReview: boolean; onClose: () => void }) {
  const refresh = useRefreshMoney()
  const [url, setUrl] = useState<string | null>(null)
  const [amount, setAmount] = useState(String(payment.amount))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState(false)
  const { data: loans } = useLoans()
  const loan = loans?.find((l) => l.id === payment.loan_id)

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
        {canReview && payment.method === 'transfer' && payment.status === 'pending' && (
          <p className={payment.slip_ref ? 'text-sm font-semibold text-ok' : 'text-sm text-muted'}>
            {payment.slip_ref ? '✓ อ่าน QR บนสลิปได้ และไม่ซ้ำกับสลิปที่เคยส่ง' : '⚠ อ่าน QR บนสลิปไม่ได้ ตรวจยอดและชื่อบัญชีจากรูปอีกครั้ง'}
          </p>
        )}
        {payment.reject_reason && <p className="text-danger">เหตุผล: {payment.reject_reason}</p>}
        {payment.note && <p className="text-muted">📝 {payment.note}</p>}
        {payment.status === 'approved' && loan && (
          <Pill className="w-full" onClick={() => setReceipt(true)}>
            🧾 ดูใบเสร็จ (บันทึก/แชร์เป็นรูป)
          </Pill>
        )}
        {receipt && loan && <ReceiptSheet loan={loan} payment={payment} onClose={() => setReceipt(false)} />}

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

/** admin: บันทึกรับเงินสด (หรือโอนที่ได้รับนอกระบบ) */
export function CashSheet({ loan, open, onClose }: { loan: Loan; open: boolean; onClose: () => void }) {
  const refresh = useRefreshMoney()
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(() => toLocalInput(new Date().toISOString()))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [through, setThrough] = useState<number | null>(null)
  const atMs = Date.parse(fromLocalInput(paidAt))
  const balance = loanSnapshot(loan, loan.payments, atMs).balance
  const daily = loan.interest_mode === 'daily'
  const [kind, setKind] = useState<'daily' | 'principal'>('daily')

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
          <Input
            type="datetime-local"
            value={paidAt}
            onChange={(e) => {
              setPaidAt(e.target.value)
              setThrough(null)
            }}
          />
        </Field>
        {daily && (
          <div className="grid grid-cols-2 gap-1 rounded-full bg-pill p-1" role="radiogroup" aria-label="แบบที่จ่าย">
            {(
              [
                ['daily', '📅 ดอกรายวัน'],
                ['principal', '💰 พร้อมเงินต้น'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => {
                  setKind(k)
                  setThrough(null)
                  setNote(k === 'principal' ? 'จ่ายพร้อมเงินต้น (ปิดยอด)' : '')
                  setAmount(k === 'principal' ? String(balance) : '')
                }}
                className={cx('rounded-full py-2 text-sm font-semibold', kind === k ? 'bg-surface text-brand-700 shadow' : 'text-muted')}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {daily && kind === 'principal' && Number.isFinite(atMs) && <PayoffSummary loan={loan} atMs={atMs} />}
        {daily && kind === 'daily' && Number.isFinite(atMs) && (
          <DayPicker
            key={paidAt}
            loan={loan}
            payments={loan.payments}
            atMs={atMs}
            through={through}
            onChange={(k, amt, label) => {
              setThrough(k)
              setNote(label)
              setAmount(amt ? String(amt) : '')
            }}
          />
        )}
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
