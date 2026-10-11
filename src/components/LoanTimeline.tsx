// ไทม์ไลน์ของรายการยืม: ยืม → เริ่มคิดดอก → จ่าย → ครบกำหนด → ค่าปรับ → ปิดยอด
// ช่วยให้เห็นว่ายอดมาจากไหน ลดการเถียงกันเรื่องตัวเลข
import { fmtBaht, fmtDate, fmtDateTime } from '../lib/format'
import { loanSnapshot } from '../lib/loanMath'
import type { Loan } from '../lib/types'
import { cx } from './ui'

type Tone = 'brand' | 'ok' | 'danger' | 'info' | 'muted'
export type TimelineEvent = { at: number; icon: string; title: string; detail?: string; tone: Tone; future?: boolean }

const DOT: Record<Tone, string> = {
  brand: 'bg-brand-600',
  ok: 'bg-ok',
  danger: 'bg-danger',
  info: 'bg-sky-500',
  muted: 'bg-pill',
}

const dayStart = (d: string) => Date.parse(`${d}T00:00:00+07:00`)

export function loanEvents(loan: Loan, now: number): TimelineEvent[] {
  const s = loanSnapshot(loan, loan.payments, now)
  const due = Date.parse(loan.due_at)
  const ev: TimelineEvent[] = [
    { at: dayStart(loan.borrowed_on), icon: '🤝', title: `ยืม ${fmtBaht(Number(loan.principal))}`, detail: fmtDate(loan.borrowed_on), tone: 'brand' },
  ]
  if (loan.interest_start_on !== loan.borrowed_on) {
    ev.push({
      at: dayStart(loan.interest_start_on) + 1,
      icon: '🌱',
      title: 'เริ่มคิดดอก',
      detail: `${fmtDate(loan.interest_start_on)} · วันละ ${fmtBaht(Number(loan.daily_interest))}`,
      tone: 'muted',
      future: dayStart(loan.interest_start_on) > now,
    })
  } else {
    ev[0].detail += ` · เริ่มคิดดอกวันละ ${fmtBaht(Number(loan.daily_interest))}`
  }

  for (const p of loan.payments) {
    const at = Date.parse(p.paid_at)
    const how = p.method === 'cash' ? 'เงินสด' : 'โอน'
    if (p.status === 'approved') {
      ev.push({ at, icon: '💸', title: `จ่าย ${fmtBaht(Number(p.amount))}`, detail: `${how} · ${fmtDateTime(at)}${p.note ? ` · ${p.note}` : ''}`, tone: 'ok' })
    } else if (p.status === 'pending') {
      ev.push({ at, icon: '📩', title: `ส่งสลิป ${fmtBaht(Number(p.amount))} รอตรวจ`, detail: fmtDateTime(at), tone: 'info' })
    } else {
      ev.push({
        at,
        icon: '↩️',
        title: `สลิป ${fmtBaht(Number(p.amount))} ไม่ผ่าน`,
        detail: `${fmtDateTime(at)}${p.reject_reason ? ` · ${p.reject_reason}` : ''}`,
        tone: 'muted',
      })
    }
  }

  ev.push({
    at: due,
    icon: '📅',
    title: s.daily ? 'ครบกำหนดคืนเงินต้น' : 'ครบกำหนดชำระ',
    detail: fmtDateTime(due),
    tone: due <= now && s.settledAt === null ? 'danger' : 'muted',
    future: due > now,
  })

  if (s.lateSince !== null && Number(loan.hourly_penalty) > 0) {
    const start = s.lateSince + 3_600_000
    ev.push({
      at: start,
      icon: '⏰',
      title: start > now ? `ค่าปรับจะเริ่ม ${fmtBaht(Number(loan.hourly_penalty))}/ชม.` : `เริ่มคิดค่าปรับ ${fmtBaht(Number(loan.hourly_penalty))}/ชม.`,
      detail: `${fmtDateTime(start)}${s.penalty > 0 ? ` · สะสม ${fmtBaht(s.penalty)} (${s.hours} ชม.)` : ''}`,
      tone: 'danger',
      future: start > now,
    })
  }

  if (s.settledAt !== null) {
    ev.push({
      at: s.settledAt + 1,
      icon: '🌸',
      title: s.state === 'pending_review' ? 'จ่ายครบ (รอตรวจสลิป)' : 'ปิดยอดแล้ว',
      detail: `${fmtDateTime(s.settledAt)} · รวมจ่าย ${fmtBaht(s.total)}`,
      tone: 'ok',
    })
  }

  // ยังไม่ปิดยอดและยังไม่ถึงกำหนด: ไม่ต้องโชว์ค่าปรับล่วงหน้า แค่วันครบกำหนดพอ
  return ev.sort((a, b) => a.at - b.at)
}

export function LoanTimeline({ loan, now }: { loan: Loan; now: number }) {
  const events = loanEvents(loan, now)
  const nowIndex = events.findIndex((e) => e.future)
  return (
    <ol className="relative ml-1">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`}>
          {i === nowIndex && (
            <div className="relative flex items-center gap-2 pb-3 pl-7 text-xs font-bold text-brand-700">
              <span className="absolute left-[3px] size-3 rounded-full bg-brand-600 ring-4 ring-brand-100" />
              ตอนนี้
              <span className="h-px flex-1 bg-brand-100" />
            </div>
          )}
          <div className={cx('relative pb-4 pl-7', e.future && 'opacity-60')}>
            {i < events.length - 1 && <span className="absolute top-4 bottom-0 left-[8px] w-0.5 bg-pill" aria-hidden />}
            <span
              className={cx(
                'absolute top-1 left-[3px] size-3 rounded-full',
                e.future ? 'border-2 border-dashed border-muted bg-surface' : DOT[e.tone],
              )}
            />
            <p className="font-semibold leading-snug">
              <span className="mr-1.5">{e.icon}</span>
              {e.title}
            </p>
            {e.detail && <p className="text-sm text-muted">{e.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
