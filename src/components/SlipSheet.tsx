// ผู้ยืม: อัปสลิปแล้วกด "ส่ง" ให้ admin ตรวจ
// รายการแบบจ่ายดอกรายวัน: เลือกก่อนว่า "จ่ายดอกรายวัน" หรือ "จ่ายพร้อมเงินต้น" แล้วไปคนละหน้า
import { useMemo, useState } from 'react'
import { fmtBaht, fmtDateTime } from '../lib/format'
import { dailyPlan, loanSnapshot } from '../lib/loanMath'
import { must, uploadSlip, useRefreshMoney } from '../lib/queries'
import { errorText, supabase } from '../lib/supabase'
import type { Loan } from '../lib/types'
import { DayPicker } from './DayPicker'
import { cx, ErrorText, Field, Input, Pill, Row, Sheet } from './ui'

type PayKind = 'daily' | 'principal'

const balanceOf = (loan: Loan, atMs: number) => loanSnapshot(loan, loan.payments, atMs).balance

/** แตกยอดปิดยอด: เงินต้น / ดอกที่ยังไม่จ่าย / ค่าปรับ (หลังหักที่จ่ายแล้ว) */
export function payoffParts(loan: Loan, atMs: number) {
  const s = loanSnapshot(loan, loan.payments, atMs)
  const principal = s.daily && dailyPlan(loan, loan.payments, atMs).principalCovered ? 0 : Number(loan.principal)
  const penalty = s.penalty
  const interest = Math.max(0, Math.round((s.balance - principal - penalty) * 100) / 100)
  return { principal: Math.min(principal, s.balance), interest, penalty, total: s.balance }
}

export function PayoffSummary({ loan, atMs }: { loan: Loan; atMs: number }) {
  const p = payoffParts(loan, atMs)
  return (
    <div className="rounded-2xl bg-canvas px-4 py-2 text-sm">
      <Row label="เงินต้น" value={fmtBaht(p.principal)} />
      <Row label="ดอกที่ยังไม่จ่าย" value={fmtBaht(p.interest)} />
      {p.penalty > 0 && <Row label="ค่าปรับสะสม" value={<span className="text-danger">{fmtBaht(p.penalty)}</span>} />}
      <div className="border-t border-line">
        <Row label="รวมปิดยอด" value={fmtBaht(p.total)} strong />
      </div>
    </div>
  )
}

function KindCard({
  icon,
  title,
  desc,
  amount,
  late,
  onClick,
}: {
  icon: string
  title: string
  desc: string
  amount: string
  late?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-4 rounded-3xl p-4 text-left transition active:scale-[.98]',
        late ? 'bg-red-50 ring-2 ring-danger/40' : 'bg-canvas ring-1 ring-line',
      )}
    >
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-surface text-3xl shadow-sm">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold">{title}</span>
        <span className="block text-sm text-muted">{desc}</span>
      </span>
      <span className="tabular shrink-0 text-right font-bold">
        {amount}
        <span className="block text-xl text-muted">›</span>
      </span>
    </button>
  )
}

export function SlipSheet({ loans, open, onClose }: { loans: Loan[]; open: boolean; onClose: () => void }) {
  const refresh = useRefreshMoney()
  const [openedAt] = useState(() => Date.now())
  const unpaid = loans.filter((l) => balanceOf(l, openedAt) > 0)
  const [loanId, setLoanId] = useState('')
  const [kind, setKind] = useState<PayKind | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [amount, setAmount] = useState('')
  const [through, setThrough] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  const selected = unpaid.find((l) => l.id === loanId) ?? unpaid[0]
  const snap = selected ? loanSnapshot(selected, selected.payments, openedAt) : null
  const isDaily = !!snap?.daily
  // รายการแบบพร้อมเงินต้นมีทางเดียว ข้ามหน้าเลือกไปเลย
  const step: PayKind | 'choose' = !isDaily ? 'principal' : (kind ?? 'choose')

  function reset() {
    setKind(null)
    setThrough(null)
    setNote('')
    setAmount('')
    setError(null)
  }

  function choose(k: PayKind) {
    reset()
    setKind(k)
    if (k === 'principal' && selected) {
      setAmount(String(payoffParts(selected, openedAt).total))
      setNote('จ่ายพร้อมเงินต้น (ปิดยอด)')
    }
  }

  async function send() {
    if (!selected || !file || !Number(amount)) return setError('เลือกสลิปและใส่ยอดเงินก่อน')
    setBusy(true)
    setError(null)
    try {
      const path = await uploadSlip(selected.id, file)
      await must(
        supabase
          .from('payments')
          .insert({ loan_id: selected.id, amount: Number(amount), method: 'transfer', slip_path: path, note: note || null }),
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
    reset()
    setFile(null)
    setDone(false)
    onClose()
  }

  const title = done
    ? 'ส่งสลิปแล้ว'
    : step === 'choose'
      ? 'จ่ายแบบไหน'
      : step === 'daily'
        ? 'จ่ายดอกรายวัน'
        : isDaily
          ? 'จ่ายพร้อมเงินต้น'
          : 'อัปสลิป'

  const slipPicker = (
    <label className="block cursor-pointer">
      <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {preview ? (
        <img src={preview} alt="ตัวอย่างสลิป" className="max-h-72 w-full rounded-2xl bg-pill object-contain" />
      ) : (
        <span className="flex h-32 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50 text-brand-700">
          <span className="text-3xl">🧾</span>
          <span className="mt-1 font-semibold">แตะเพื่อเลือกรูปสลิป</span>
        </span>
      )}
    </label>
  )

  return (
    <Sheet open={open} onClose={close} title={title}>
      {done ? (
        <div className="space-y-4 py-6 text-center">
          <div className="text-6xl">✅</div>
          <p className="text-lg font-semibold">ส่งสลิปแล้ว</p>
          {note && <p className="font-semibold text-brand-700">{note}</p>}
          <p className="text-muted">ระบบหยุดนับค่าปรับ ณ เวลาที่ส่ง ถ้าสลิปไม่ผ่านการตรวจ ค่าปรับจะนับต่อ</p>
          <Pill tone="brand" className="w-full" onClick={close}>
            ตกลง
          </Pill>
        </div>
      ) : !selected || !snap ? (
        <p className="py-6 text-center text-muted">ไม่มียอดค้างชำระ 🎉</p>
      ) : (
        <div className="space-y-4">
          {step !== 'choose' && isDaily && (
            <button type="button" onClick={reset} className="-mt-2 text-sm font-semibold text-brand-700">
              ‹ เปลี่ยนแบบจ่าย
            </button>
          )}

          {unpaid.length > 1 && (step === 'choose' || !isDaily) && (
            <Field label="รายการที่จะจ่าย">
              <select
                className="h-12 w-full rounded-2xl bg-pill px-4"
                value={selected.id}
                onChange={(e) => {
                  setLoanId(e.target.value)
                  reset()
                }}
              >
                {unpaid.map((l) => (
                  <option key={l.id} value={l.id}>
                    {fmtBaht(Number(l.principal))} · {l.interest_mode === 'daily' ? 'ดอกรายวัน' : 'พร้อมเงินต้น'} · ครบ{' '}
                    {fmtDateTime(l.due_at)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {step === 'choose' && (
            <div className="space-y-3">
              <KindCard
                icon="📅"
                title="จ่ายดอกรายวัน"
                desc={
                  snap.arrearsAmount > 0
                    ? `ค้างอยู่ ${fmtBaht(snap.arrearsAmount)} · เลือกวันที่จะจ่าย`
                    : `ดอกวันละ ${fmtBaht(Number(selected.daily_interest))} · เลือกวันที่จะจ่าย`
                }
                amount={fmtBaht(snap.arrearsAmount > 0 ? snap.arrearsAmount : (snap.nextDue?.amount ?? 0))}
                late={snap.arrearsAmount > 0}
                onClick={() => choose('daily')}
              />
              <KindCard
                icon="💰"
                title="จ่ายพร้อมเงินต้น"
                desc="คืนเงินต้น + ดอกที่ค้าง + ค่าปรับ ปิดยอดทั้งหมด"
                amount={fmtBaht(snap.balance)}
                onClick={() => choose('principal')}
              />
            </div>
          )}

          {step === 'daily' && (
            <>
              <DayPicker
                key={selected.id}
                loan={selected}
                payments={selected.payments}
                atMs={openedAt}
                through={through}
                onChange={(k, amt, label) => {
                  setThrough(k)
                  setNote(label)
                  setAmount(amt ? String(amt) : '')
                }}
              />
              {slipPicker}
              <Field label="ยอดที่โอน (บาท)" hint="คำนวณจากวันที่เลือก">
                <Input type="number" value={amount} readOnly className="font-bold" />
              </Field>
            </>
          )}

          {step === 'principal' && (
            <>
              {isDaily && <PayoffSummary loan={selected} atMs={openedAt} />}
              {slipPicker}
              <Field
                label="ยอดที่โอน (บาท)"
                hint={isDaily ? 'ปิดยอดทั้งหมด หรือแก้เป็นยอดที่โอนจริง' : `ยอดคงเหลือทั้งหมด ${fmtBaht(snap.balance)}`}
              >
                <div className="flex gap-2">
                  <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
                  <button
                    type="button"
                    className="shrink-0 rounded-2xl bg-pill px-4 text-sm font-semibold"
                    onClick={() => setAmount(String(snap.balance))}
                  >
                    เต็มยอด
                  </button>
                </div>
              </Field>
            </>
          )}

          {step !== 'choose' && (
            <>
              <ErrorText error={error} />
              <Pill tone="brand" className="w-full" disabled={busy || !file || !Number(amount)} onClick={send}>
                {busy ? 'กำลังส่ง…' : 'ส่งให้ผู้ดูแลตรวจ'}
              </Pill>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
