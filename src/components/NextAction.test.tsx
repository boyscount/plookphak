import { describe, expect, it } from 'vitest'
import type { Loan } from '../lib/types'
import { pickActions, whenLabel } from './NextAction'

const base: Loan = {
  id: 'a',
  borrower_id: 'b',
  principal: 1000,
  borrowed_on: '2026-10-01',
  interest_start_on: '2026-10-01',
  daily_interest: 20,
  due_at: '2026-10-20T10:00:00Z',
  hourly_penalty: 20,
  interest_mode: 'with_principal',
  daily_cutoff: '17:00',
  note: null,
  payments: [],
} as unknown as Loan

describe('NextAction', () => {
  it('puts late loans first, then nearest deadline', () => {
    const now = Date.parse('2026-10-15T03:00:00Z')
    const far = { ...base, id: 'far', due_at: '2026-10-25T10:00:00Z' }
    const near = { ...base, id: 'near', due_at: '2026-10-18T10:00:00Z' }
    const late = { ...base, id: 'late', due_at: '2026-10-14T10:00:00Z' }
    expect(pickActions([far, near, late], now).map((a) => a.loan.id)).toEqual(['late', 'near', 'far'])
  })

  it('skips paid loans', () => {
    const now = Date.parse('2026-10-15T03:00:00Z')
    const paid = { ...base, payments: [{ amount: 99999, status: 'approved', paid_at: '2026-10-02T00:00:00Z', created_at: '2026-10-02T00:00:00Z' }] } as unknown as Loan
    expect(pickActions([paid], now)).toEqual([])
  })

  it('labels today/tomorrow in Bangkok time', () => {
    const now = Date.parse('2026-10-15T03:00:00Z') // 10:00 ไทย
    expect(whenLabel(Date.parse('2026-10-15T10:00:00Z'), now)).toMatch(/^วันนี้ 17:00/)
    expect(whenLabel(Date.parse('2026-10-16T10:00:00Z'), now)).toMatch(/^พรุ่งนี้ 17:00/)
  })
})
