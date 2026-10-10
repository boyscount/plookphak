import { fmtBaht, fromLocalInput, toLocalInput, todayBkk } from '../lib/format'
import type { Loan } from '../lib/types'
import type { InterestMode } from '../lib/loanMath'
import { cx, Field, Input } from './ui'

export type LoanInput = {
  principal: number
  borrowed_on: string
  interest_start_on: string
  daily_interest: number
  due_at: string
  hourly_penalty: number
  interest_mode: InterestMode
  daily_cutoff: string
  note: string | null
}

export function emptyLoanDraft() {
  const today = todayBkk()
  return {
    principal: '',
    borrowed_on: today,
    interest_start_on: today,
    daily_interest: '',
    due_local: toLocalInput(new Date(Date.now() + 30 * 86_400_000).toISOString()).slice(0, 10) + 'T18:00',
    hourly_penalty: '',
    interest_mode: 'with_principal' as InterestMode,
    daily_cutoff: '17:00',
    note: '',
  }
}

export type LoanDraft = ReturnType<typeof emptyLoanDraft>

export function draftFromLoan(l: Loan): LoanDraft {
  return {
    principal: String(l.principal),
    borrowed_on: l.borrowed_on,
    interest_start_on: l.interest_start_on,
    daily_interest: String(l.daily_interest),
    due_local: toLocalInput(l.due_at),
    hourly_penalty: String(l.hourly_penalty),
    interest_mode: l.interest_mode ?? 'with_principal',
    daily_cutoff: (l.daily_cutoff ?? '17:00').slice(0, 5),
    note: l.note ?? '',
  }
}

/** คืน error เป็นข้อความ หรือข้อมูลที่พร้อมบันทึก */
export function parseLoanDraft(d: LoanDraft): LoanInput | string {
  const principal = Number(d.principal)
  if (!(principal > 0)) return 'ใส่จำนวนเงินที่ยืม'
  if (!d.borrowed_on || !d.interest_start_on || !d.due_local) return 'ใส่วันที่ให้ครบ'
  const daily = Number(d.daily_interest || 0)
  const penalty = Number(d.hourly_penalty || 0)
  if (daily < 0 || penalty < 0) return 'ดอกเบี้ยและค่าปรับต้องไม่ติดลบ'
  if (d.interest_mode === 'daily' && !/^\d{2}:\d{2}$/.test(d.daily_cutoff)) return 'ใส่เวลาตัดรอบดอกรายวัน'
  return {
    principal,
    borrowed_on: d.borrowed_on,
    interest_start_on: d.interest_start_on,
    daily_interest: daily,
    due_at: fromLocalInput(d.due_local),
    hourly_penalty: penalty,
    interest_mode: d.interest_mode,
    daily_cutoff: d.daily_cutoff,
    note: d.note.trim() || null,
  }
}

const MODES: { id: InterestMode; label: string; hint: string }[] = [
  { id: 'with_principal', label: 'จ่ายดอกพร้อมเงินต้น', hint: 'จ่ายทีเดียวตอนครบกำหนด' },
  { id: 'daily', label: 'จ่ายดอกรายวัน', hint: 'อัปสลิปดอกทุกวันก่อนเวลาตัดรอบ' },
]

export function LoanFields({ draft, onChange }: { draft: LoanDraft; onChange: (d: LoanDraft) => void }) {
  const set = (k: keyof LoanDraft) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...draft, [k]: e.target.value })
  const yearly = Number(draft.principal) > 0 ? (Number(draft.daily_interest || 0) * 365 * 100) / Number(draft.principal) : 0
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-sm font-semibold text-ink/80">รูปแบบการจ่ายดอกเบี้ย</span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={draft.interest_mode === m.id}
              onClick={() => onChange({ ...draft, interest_mode: m.id })}
              className={cx(
                'rounded-2xl border-2 px-4 py-3 text-left',
                draft.interest_mode === m.id ? 'border-brand-600 bg-brand-50' : 'border-transparent bg-pill',
              )}
            >
              <span className={cx('block font-semibold', draft.interest_mode === m.id && 'text-brand-700')}>{m.label}</span>
              <span className="mt-0.5 block text-xs text-muted">{m.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <Field label="จำนวนเงินที่ยืม (บาท)">
        <Input type="number" inputMode="decimal" value={draft.principal} onChange={set('principal')} placeholder="5000" />
      </Field>
      <Field label="วันที่ยืม">
        <Input type="date" value={draft.borrowed_on} onChange={set('borrowed_on')} />
      </Field>
      <Field label="วันที่เริ่มคิดดอกเบี้ย" hint="วันนี้นับเป็นวันที่ 1">
        <Input type="date" value={draft.interest_start_on} onChange={set('interest_start_on')} />
      </Field>
      <Field
        label="ดอกเบี้ยต่อวัน (บาท)"
        hint={yearly > 0 ? `≈ ${yearly.toFixed(1)}% ต่อปี${yearly > 15 ? ' · เกินเพดานกฎหมาย 15%/ปี' : ''}` : undefined}
      >
        <Input type="number" inputMode="decimal" value={draft.daily_interest} onChange={set('daily_interest')} placeholder="50" />
      </Field>
      <Field label="วันครบกำหนดชำระ (วันและเวลา)">
        <Input type="datetime-local" value={draft.due_local} onChange={set('due_local')} />
      </Field>
      {draft.interest_mode === 'daily' && (
        <Field label="เวลาตัดรอบดอกรายวัน" hint="ต้องอัปสลิปดอกของแต่ละวันก่อนเวลานี้">
          <Input type="time" value={draft.daily_cutoff} onChange={set('daily_cutoff')} />
        </Field>
      )}
      <Field
        label="ค่าปรับต่อชั่วโมง (บาท)"
        hint={
          draft.interest_mode === 'daily'
            ? 'เลยตัดรอบหรือวันคืนเงินต้นครบ 1 ชม. เริ่มปรับ · ค้างกี่วันก็ปรับก้อนเดียว'
            : 'เริ่มปรับเมื่อเลยกำหนดครบ 1 ชม.'
        }
      >
        <Input type="number" inputMode="decimal" value={draft.hourly_penalty} onChange={set('hourly_penalty')} placeholder="20" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="หมายเหตุ">
          <Input value={draft.note} onChange={set('note')} placeholder="เช่น ยืมไปซ่อมรถ" />
        </Field>
      </div>
      {Number(draft.principal) > 0 && (
        <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700 sm:col-span-2">
          {draft.interest_mode === 'daily'
            ? `ต้องจ่ายดอก ${fmtBaht(Number(draft.daily_interest || 0))} ทุกวันก่อน ${draft.daily_cutoff} น. และคืนเงินต้นวันครบกำหนด · ดอกรวมทั้งหมดประมาณ `
            : 'ตัวอย่าง: ถ้าจ่ายตรงวันครบชำระ ยอดจะประมาณ '}
          <b>
            {fmtBaht(
              (draft.interest_mode === 'daily' ? 0 : Number(draft.principal)) +
                Number(draft.daily_interest || 0) *
                  Math.max(
                    0,
                    Math.floor((Date.parse(fromLocalInput(draft.due_local)) - Date.parse(`${draft.interest_start_on}T00:00:00+07:00`)) / 86_400_000) + 1,
                  ),
            )}
          </b>
        </p>
      )}
    </div>
  )
}
