import { describe, expect, it } from 'vitest'
import { receiptData } from '../lib/receipt'
import type { Loan } from '../lib/types'
import { loanEvents } from './LoanTimeline'

const loan = {
  id: 'l',
  borrower_id: 'b',
  borrower: { aka: 'ต้น' },
  principal: 1000,
  borrowed_on: '2026-10-01',
  interest_start_on: '2026-10-01',
  daily_interest: 10,
  due_at: '2026-10-05T10:00:00Z',
  hourly_penalty: 20,
  interest_mode: 'with_principal',
  daily_cutoff: '17:00',
  note: null,
  payments: [
    { id: 'p1-aaaa-bbbb', loan_id: 'l', amount: 300, method: 'transfer', status: 'approved', paid_at: '2026-10-03T05:00:00Z', note: null },
    { id: 'p2', loan_id: 'l', amount: 50, method: 'transfer', status: 'rejected', paid_at: '2026-10-03T06:00:00Z', note: null, reject_reason: 'ยอดไม่ตรง' },
  ],
} as unknown as Loan

describe('loanEvents', () => {
  it('orders borrow, payments, due date and penalty start; marks future items', () => {
    const now = Date.parse('2026-10-05T12:00:00Z') // เลยกำหนด 2 ชม.
    const ev = loanEvents(loan, now)
    expect(ev.map((e) => e.icon)).toEqual(['🤝', '💸', '↩️', '📅', '⏰'])
    expect(ev.find((e) => e.icon === '📅')!.tone).toBe('danger')
    expect(ev.find((e) => e.icon === '⏰')!.future).toBe(false)
  })

  it('shows the due date as upcoming before it arrives', () => {
    const ev = loanEvents(loan, Date.parse('2026-10-02T00:00:00Z'))
    expect(ev.at(-1)).toMatchObject({ icon: '📅', future: true })
    expect(ev.some((e) => e.icon === '⏰')).toBe(false)
  })
})

describe('receiptData', () => {
  it('balance after a payment only counts approved payments up to that time', () => {
    const d = receiptData(loan, loan.payments[0])
    expect(d.name).toBe('ต้น')
    expect(d.amount).toBe(300)
    // ดอก 3 วัน (1–3 ต.ค.) = 30 → 1030 − 300
    expect(d.balanceAfter).toBe(730)
    expect(d.no).toBe('P1AAAABBBB')
  })
})
