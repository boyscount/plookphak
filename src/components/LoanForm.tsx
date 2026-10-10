import { fmtBaht, fromLocalInput, toLocalInput, todayBkk } from '../lib/format'
import type { Loan } from '../lib/types'
import { Field, Input } from './ui'

export type LoanInput = {
  principal: number
  borrowed_on: string
  interest_start_on: string
  daily_interest: number
  due_at: string
  hourly_penalty: number
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
  return {
    principal,
    borrowed_on: d.borrowed_on,
    interest_start_on: d.interest_start_on,
    daily_interest: daily,
    due_at: fromLocalInput(d.due_local),
    hourly_penalty: penalty,
    note: d.note.trim() || null,
  }
}

export function LoanFields({ draft, onChange }: { draft: LoanDraft; onChange: (d: LoanDraft) => void }) {
  const set = (k: keyof LoanDraft) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...draft, [k]: e.target.value })
  const yearly = Number(draft.principal) > 0 ? (Number(draft.daily_interest || 0) * 365 * 100) / Number(draft.principal) : 0
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="จำนวนเงินที่ยืม (บาท)">
        <Input type="number" inputMode="decimal" value={draft.principal} onChange={set('principal')} placeholder="5000" />
      </Field>
      <Field label="วันที่ยืม">
        <Input type="date" value={draft.borrowed_on} onChange={set('borrowed_on')} />
      </Field>
      <Field label="วันที่เริ่มคิดดอก" hint="วันนี้นับเป็นวันที่ 1">
        <Input type="date" value={draft.interest_start_on} onChange={set('interest_start_on')} />
      </Field>
      <Field
        label="ดอกต่อวัน (บาท)"
        hint={yearly > 0 ? `≈ ${yearly.toFixed(1)}% ต่อปี${yearly > 15 ? ' · เกินเพดานกฎหมาย 15%/ปี' : ''}` : undefined}
      >
        <Input type="number" inputMode="decimal" value={draft.daily_interest} onChange={set('daily_interest')} placeholder="50" />
      </Field>
      <Field label="วันครบชำระ (วันและเวลา)">
        <Input type="datetime-local" value={draft.due_local} onChange={set('due_local')} />
      </Field>
      <Field label="ค่าปรับต่อชั่วโมง (บาท)" hint="เริ่มปรับเมื่อเลยกำหนดครบ 1 ชม.">
        <Input type="number" inputMode="decimal" value={draft.hourly_penalty} onChange={set('hourly_penalty')} placeholder="20" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="หมายเหตุ">
          <Input value={draft.note} onChange={set('note')} placeholder="เช่น ยืมไปซ่อมรถ" />
        </Field>
      </div>
      {Number(draft.principal) > 0 && (
        <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700 sm:col-span-2">
          ตัวอย่าง: ถ้าจ่ายตรงวันครบชำระ ยอดจะประมาณ{' '}
          <b>
            {fmtBaht(
              Number(draft.principal) +
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
