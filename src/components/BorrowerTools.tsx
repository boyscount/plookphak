// เครื่องมือฝั่งผู้ยืม: คำนวณปิดยอด และส่งคำขอเลื่อนวัน/ขอผ่อน (+ หน้าตรวจคำขอของ admin)
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { fmtBaht, fmtDate, fmtDateTime, fromLocalInput, toLocalInput, todayBkk, timeAgo } from '../lib/format'
import { loanSnapshot, owedAt, penaltyWords } from '../lib/loanMath'
import { must, useLoanRequests, type LoanRequest } from '../lib/queries'
import { errorText, supabase } from '../lib/supabase'
import type { Loan } from '../lib/types'
import { cx, EmptyState, ErrorText, Field, Input, Pill, Row, Sheet } from './ui'

const DAY = 86_400_000

function LoanSelect({ loans, value, onChange }: { loans: Loan[]; value: string; onChange: (id: string) => void }) {
  if (loans.length < 2) return null
  return (
    <Field label="รายการ">
      <select className="h-12 w-full rounded-2xl bg-pill px-4" value={value} onChange={(e) => onChange(e.target.value)}>
        {loans.map((l) => (
          <option key={l.id} value={l.id}>
            {fmtBaht(Number(l.principal))} · {l.interest_mode === 'daily' ? 'ดอกรายวัน' : 'พร้อมเงินต้น'} · ครบ {fmtDateTime(l.due_at)}
          </option>
        ))}
      </select>
    </Field>
  )
}

/** เวลาที่ใช้คำนวณของวันที่เลือก: วันนี้ = ตอนนี้, วันครบกำหนด = ก่อนเวลาครบกำหนดนิดเดียว, วันอื่น = เที่ยงวันนั้น (เวลาไทย) */
function atOf(ymd: string, loan: Loan) {
  const dueAt = Date.parse(loan.due_at) - 60_000
  if (ymd === todayBkk()) return Date.now()
  if (ymd === new Date(dueAt + 7 * 3_600_000).toISOString().slice(0, 10)) return Math.max(Date.now(), dueAt)
  return Date.parse(`${ymd}T12:00:00+07:00`)
}

export function PayoffCalculatorSheet({ loans, open, onClose }: { loans: Loan[]; open: boolean; onClose: () => void }) {
  const openLoans = loans.filter((l) => loanSnapshot(l, l.payments, Date.now()).balance > 0)
  const [loanId, setLoanId] = useState('')
  const loan = openLoans.find((l) => l.id === loanId) ?? openLoans[0]
  const [date, setDate] = useState(todayBkk)

  const result = useMemo(() => {
    if (!loan) return null
    const at = atOf(date, loan)
    const dueAt = Date.parse(loan.due_at) - 60_000 // ก่อนครบกำหนดนิดเดียว
    const snap = loanSnapshot(loan, loan.payments, at)
    const owed = owedAt(loan, loan.payments, at)
    const atDue = loanSnapshot(loan, loan.payments, Math.max(Date.now(), dueAt)).balance
    return { at, snap, owed, atDue, diff: Math.round((atDue - snap.balance) * 100) / 100 }
  }, [loan, date])

  const quick = loan
    ? [
        { label: 'วันนี้', ymd: todayBkk() },
        { label: 'พรุ่งนี้', ymd: new Date(Date.now() + 7 * 3_600_000 + DAY).toISOString().slice(0, 10) },
        { label: '+7 วัน', ymd: new Date(Date.now() + 7 * 3_600_000 + 7 * DAY).toISOString().slice(0, 10) },
        { label: 'วันครบกำหนด', ymd: new Date(Date.parse(loan.due_at) + 7 * 3_600_000).toISOString().slice(0, 10) },
      ]
    : []

  return (
    <Sheet open={open} onClose={onClose} title="🧮 คำนวณปิดยอด">
      {!loan || !result ? (
        <p className="py-6 text-center text-muted">ไม่มียอดค้าง 🎉</p>
      ) : (
        <div className="space-y-4">
          <LoanSelect loans={openLoans} value={loan.id} onChange={setLoanId} />
          <Field label="ถ้าปิดยอดวันที่">
            <Input type="date" value={date} min={todayBkk()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setDate(q.ymd)}
                className={cx('rounded-full px-3 py-1.5 text-sm font-semibold', date === q.ymd ? 'bg-brand-600 text-white' : 'bg-pill')}
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-[#4b22a8] to-[#9a5cff] p-5 text-center text-white">
            <p className="text-sm text-white/80">ยอดปิดถ้าจ่ายวันที่ {fmtDate(date)}</p>
            <p className="tabular mt-1 text-4xl font-bold">{fmtBaht(result.snap.balance)}</p>
            {result.diff > 0.009 ? (
              <p className="mt-2 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
                🎉 ประหยัดกว่าจ่ายตอนครบกำหนด {fmtBaht(result.diff)}
              </p>
            ) : result.diff < -0.009 ? (
              <p className="mt-2 rounded-full bg-[#ff4d5e] px-3 py-1 text-sm font-semibold">
                ⚠️ แพงกว่าจ่ายตอนครบกำหนด {fmtBaht(-result.diff)} (ค่าปรับ/ดอกเพิ่ม)
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl bg-canvas px-4 py-2 text-sm">
            <Row label="เงินต้น" value={fmtBaht(Number(loan.principal))} />
            <Row label={`ดอกเบี้ย (${result.owed.days} วัน)`} value={fmtBaht(result.owed.interest)} />
            {result.owed.penalty > 0 && (
              <Row label={`ค่าปรับ (${result.owed.hours} ${penaltyWords(loan).short})`} value={<span className="text-danger">{fmtBaht(result.owed.penalty)}</span>} />
            )}
            {result.snap.approved + result.snap.pending > 0 && (
              <Row label="จ่ายไปแล้ว" value={<span className="text-ok">− {fmtBaht(result.snap.approved + result.snap.pending)}</span>} />
            )}
            <div className="border-t border-line">
              <Row label="ยอดปิด" value={fmtBaht(result.snap.balance)} strong />
            </div>
          </div>
          <p className="text-xs text-muted">
            คิดแบบไม่ได้จ่ายเพิ่มจนถึงวันนั้น
            {loan.interest_mode === 'daily' && ' — แบบดอกรายวันถ้าไม่จ่ายดอกแต่ละวันจะมีค่าปรับรวมอยู่ด้วย'}
          </p>
        </div>
      )}
    </Sheet>
  )
}

const statusChip: Record<LoanRequest['status'], { t: string; c: string }> = {
  pending: { t: 'รอพิจารณา', c: 'bg-sky-100 text-sky-800' },
  approved: { t: 'อนุมัติ', c: 'bg-emerald-100 text-ok' },
  rejected: { t: 'ไม่อนุมัติ', c: 'bg-red-100 text-danger' },
}

function requestText(r: LoanRequest) {
  return r.kind === 'extend' ? `ขอเลื่อนเป็น ${fmtDateTime(r.proposed_due_at!)}` : `ขอผ่อน ${r.installments} งวด`
}

export function RequestSheet({ loans, open, onClose }: { loans: Loan[]; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: requests } = useLoanRequests()
  const openLoans = loans.filter((l) => loanSnapshot(l, l.payments, Date.now()).balance > 0)
  const [loanId, setLoanId] = useState('')
  const loan = openLoans.find((l) => l.id === loanId) ?? openLoans[0]
  const [kind, setKind] = useState<'extend' | 'installment'>('extend')
  const [due, setDue] = useState<string | null>(null)
  const [count, setCount] = useState('3')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const dueValue = due ?? (loan ? toLocalInput(new Date(Date.parse(loan.due_at) + 7 * DAY).toISOString()) : '')
  const pendingForLoan = requests?.some((r) => r.loan_id === loan?.id && r.status === 'pending')

  async function send() {
    if (!loan) return
    if (!message.trim()) return setError('บอกเหตุผลสั้น ๆ ให้ผู้ดูแลหน่อย')
    setBusy(true)
    setError(null)
    try {
      await must(
        supabase.from('loan_requests').insert({
          loan_id: loan.id,
          kind,
          proposed_due_at: kind === 'extend' ? fromLocalInput(dueValue) : null,
          installments: kind === 'installment' ? Number(count) : null,
          message: message.trim(),
        }),
      )
      qc.invalidateQueries({ queryKey: ['requests'] })
      setSent(true)
      setMessage('')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function cancel(id: string) {
    await supabase.from('loan_requests').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['requests'] })
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        setSent(false)
        onClose()
      }}
      title="🙏 ขอเลื่อน / ขอผ่อน"
    >
      <div className="space-y-4">
        {sent ? (
          <div className="space-y-3 py-4 text-center">
            <div className="text-5xl">📨</div>
            <p className="font-semibold">ส่งคำขอแล้ว รอผู้ดูแลพิจารณา</p>
            <p className="text-sm text-muted">ระหว่างรอ ดอกและค่าปรับยังเดินตามปกติ</p>
            <Pill className="w-full" onClick={() => setSent(false)}>
              ดูคำขอของฉัน
            </Pill>
          </div>
        ) : !loan ? (
          <p className="py-4 text-center text-muted">ไม่มียอดค้าง 🎉</p>
        ) : (
          <>
            <LoanSelect loans={openLoans} value={loan.id} onChange={setLoanId} />
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {(
                [
                  ['extend', '📆 เลื่อนวันครบกำหนด'],
                  ['installment', '🧩 ขอผ่อนเป็นงวด'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={cx(
                    'rounded-2xl border-2 px-3 py-3 text-sm font-semibold',
                    kind === k ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-transparent bg-pill',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {kind === 'extend' ? (
              <Field label="ขอเลื่อนเป็นวันที่" hint={`ตอนนี้ครบกำหนด ${fmtDateTime(loan.due_at)}`}>
                <Input type="datetime-local" value={dueValue} onChange={(e) => setDue(e.target.value)} />
              </Field>
            ) : (
              <Field label="จำนวนงวด" hint="ผู้ดูแลจะตกลงรายละเอียดแต่ละงวดกับคุณอีกที">
                <select className="h-12 w-full rounded-2xl bg-pill px-4" value={count} onChange={(e) => setCount(e.target.value)}>
                  {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} งวด
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="เหตุผล">
              <textarea
                className="min-h-24 w-full rounded-2xl border-2 border-transparent bg-pill px-4 py-3 outline-none focus:border-brand-500 focus:bg-surface"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="เช่น เงินเดือนออกช้า ขอเลื่อนไปสิ้นเดือน"
              />
            </Field>
            <ErrorText error={error} />
            <Pill tone="brand" className="w-full" disabled={busy || pendingForLoan} onClick={send}>
              {pendingForLoan ? 'มีคำขอรอพิจารณาอยู่แล้ว' : busy ? 'กำลังส่ง…' : 'ส่งคำขอ'}
            </Pill>
          </>
        )}

        {!!requests?.length && (
          <div>
            <h3 className="mb-2 font-bold">คำขอของฉัน</h3>
            <ul className="space-y-2">
              {requests.map((r) => (
                <li key={r.id} className="rounded-2xl bg-canvas p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{requestText(r)}</span>
                    <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', statusChip[r.status].c)}>
                      {statusChip[r.status].t}
                    </span>
                  </div>
                  <p className="mt-1 text-muted">“{r.message}”</p>
                  {r.admin_note && <p className="mt-1 text-brand-700">ผู้ดูแล: {r.admin_note}</p>}
                  <div className="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>{timeAgo(r.created_at)}</span>
                    {r.status === 'pending' && (
                      <button type="button" className="underline" onClick={() => cancel(r.id)}>
                        ยกเลิกคำขอ
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  )
}

/** admin: ตรวจคำขอ — อนุมัติเลื่อนวันแล้วระบบเปลี่ยนวันครบกำหนดให้เอง */
export function RequestReviewList({ names }: { names: Record<string, string> }) {
  const qc = useQueryClient()
  const { data: requests } = useLoanRequests()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  async function decide(r: LoanRequest, status: 'approved' | 'rejected') {
    setError(null)
    const { error } = await supabase
      .from('loan_requests')
      .update({ status, admin_note: notes[r.id]?.trim() || null })
      .eq('id', r.id)
    if (error) return setError(errorText(error))
    qc.invalidateQueries({ queryKey: ['requests'] })
    qc.invalidateQueries({ queryKey: ['loans'] })
  }

  if (!requests?.length) return <EmptyState title="ยังไม่มีคำขอ" subtitle="ผู้ยืมขอเลื่อนหรือขอผ่อนได้จากหน้าแรกของเขา" />
  return (
    <div className="space-y-2">
      <ErrorText error={error} />
      {requests.map((r) => (
        <div key={r.id} className="rounded-2xl card-depth p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold">{names[r.borrower_id] ?? 'ผู้ยืม'}</span>
            <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', statusChip[r.status].c)}>{statusChip[r.status].t}</span>
          </div>
          <p className="mt-1 font-semibold">{requestText(r)}</p>
          <p className="text-sm text-muted">“{r.message}” · {timeAgo(r.created_at)}</p>
          {r.admin_note && <p className="mt-1 text-sm text-brand-700">หมายเหตุ: {r.admin_note}</p>}
          {r.status === 'pending' && (
            <div className="mt-3 space-y-2">
              <Input
                placeholder="หมายเหตุถึงผู้ยืม (ถ้ามี)"
                value={notes[r.id] ?? ''}
                onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Pill tone="ok" onClick={() => decide(r, 'approved')}>
                  ✓ อนุมัติ
                </Pill>
                <Pill tone="danger" onClick={() => decide(r, 'rejected')}>
                  ✕ ไม่อนุมัติ
                </Pill>
              </div>
              {r.kind === 'extend' && <p className="text-xs text-muted">อนุมัติแล้วระบบเปลี่ยนวันครบกำหนดให้อัตโนมัติ</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
