// เทียบสูตร TS กับ public.loan_totals / loan_settled_at ใน Postgres ในเครื่อง
// รัน: npm run test:parity (ต้อง supabase start + db reset ก่อน)
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { loanSnapshot, owedAt, settledAt, type LoanTerms, type PaymentLike } from '../src/lib/loanMath'

const enabled = process.env.PARITY === '1'

type Case = { name: string; loan: Required<LoanTerms>; payments: PaymentLike[] }

const base = {
  principal: 1000,
  interest_start_on: '2026-10-01',
  daily_interest: 50,
  hourly_penalty: 20,
  daily_cutoff: '17:00:00',
  penalty_unit: 'hour' as const,
}
const iso = (s: string) => new Date(s).toISOString()
const P = (amount: number, at: string, status: PaymentLike['status'] = 'approved'): PaymentLike => ({
  amount,
  paid_at: iso(at),
  status,
})

const cases: Case[] = [
  { name: 'พร้อมต้น ไม่จ่าย', loan: { ...base, interest_mode: 'with_principal', due_at: iso('2026-10-05T18:00:00+07:00') }, payments: [] },
  {
    name: 'พร้อมต้น จ่ายบางส่วน + ครบ',
    loan: { ...base, interest_mode: 'with_principal', due_at: iso('2026-10-05T18:00:00+07:00') },
    payments: [P(500, '2026-10-02T10:00:00+07:00'), P(1100, '2026-10-06T09:30:00+07:00', 'pending')],
  },
  {
    name: 'พร้อมต้น ปรับต่อวัน ไม่จ่าย',
    loan: { ...base, interest_mode: 'with_principal', penalty_unit: 'day', hourly_penalty: 160, due_at: iso('2026-10-05T18:00:00+07:00') },
    payments: [],
  },
  {
    name: 'พร้อมต้น ปรับต่อวัน จ่ายบางส่วนแล้วปิดยอดหลังเลยกำหนด',
    loan: { ...base, interest_mode: 'with_principal', penalty_unit: 'day', hourly_penalty: 160, due_at: iso('2026-10-05T18:00:00+07:00') },
    payments: [P(300, '2026-10-03T12:00:00+07:00'), P(1110, '2026-10-06T20:00:00+07:00', 'pending')],
  },
  {
    name: 'รายวัน แต่ตั้ง penalty_unit=day (ต้องไม่มีผล)',
    loan: { ...base, interest_mode: 'daily', penalty_unit: 'day', due_at: iso('2026-10-10T18:00:00+07:00') },
    payments: [P(50, '2026-10-01T09:00:00+07:00')],
  },
  { name: 'รายวัน ไม่จ่าย', loan: { ...base, interest_mode: 'daily', due_at: iso('2026-10-10T18:00:00+07:00') }, payments: [] },
  {
    name: 'รายวัน จ่ายช้า/ตรงเวลา/ถูกปฏิเสธ',
    loan: { ...base, interest_mode: 'daily', due_at: iso('2026-10-06T18:00:00+07:00'), daily_cutoff: '09:30:00' },
    payments: [
      P(50, '2026-10-01T09:30:00+07:00'),
      P(50, '2026-10-02T13:15:00+07:00', 'pending'),
      P(100, '2026-10-04T08:00:00+07:00', 'rejected'),
      P(120, '2026-10-04T22:00:00+07:00'),
      P(1300, '2026-10-07T02:00:00+07:00'),
    ],
  },
]

const times = [
  '2026-09-30T12:00:00+07:00',
  '2026-10-01T17:00:00+07:00',
  '2026-10-01T18:00:00+07:00',
  '2026-10-02T10:45:00+07:00',
  '2026-10-03T23:59:00+07:00',
  '2026-10-05T18:00:00+07:00',
  '2026-10-05T18:00:30+07:00',
  '2026-10-05T19:30:00+07:00',
  '2026-10-06T17:59:59+07:00',
  '2026-10-06T18:00:00+07:00',
  '2026-10-06T20:00:00+07:00',
  '2026-10-07T05:00:00+07:00',
  '2026-10-11T12:00:00+07:00',
].map(iso)

const lit = (v: unknown) => (v === null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)

function sqlFor(c: Case) {
  const l = c.loan
  return `
begin;
with b as (select id from public.profiles where username = 'somchai'),
ins as (
  insert into public.loans (borrower_id, principal, borrowed_on, interest_start_on, daily_interest, due_at, hourly_penalty, interest_mode, daily_cutoff, penalty_unit)
  select id, ${l.principal}, ${lit(l.interest_start_on)}, ${lit(l.interest_start_on)}, ${l.daily_interest}, ${lit(l.due_at)},
         ${l.hourly_penalty}, ${lit(l.interest_mode)}, ${lit(l.daily_cutoff)}, ${lit(l.penalty_unit)} from b returning id
)
select id from ins \\gset
${c.payments
  .map(
    (p, i) =>
      `insert into public.payments (loan_id, amount, method, paid_at, status, created_at) values (:'id', ${p.amount}, 'cash', ${lit(p.paid_at)}, ${lit(p.status)}, now() + interval '${i} second');`,
  )
  .join('\n')}
select json_build_object(
  'settled', public.loan_settled_at(:'id'),
  'rows', (select json_agg(json_build_object('at', t.at, 'total', x.total, 'penalty_hours', x.penalty_hours, 'arrears_since', x.arrears_since))
           from unnest(array[${times.map(lit).join(',')}]::timestamptz[]) t(at), lateral public.loan_totals(:'id', t.at) x)
);
rollback;`
}

describe.skipIf(!enabled)('SQL = TS', () => {
  for (const c of cases) {
    it(c.name, () => {
      const out = execFileSync('docker', ['exec', '-i', 'supabase_db_plookphak', 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], {
        input: sqlFor(c),
        encoding: 'utf8',
      })
      const json = JSON.parse(out.split('\n').find((s) => s.startsWith('{'))!)
      const ts = settledAt(c.loan, c.payments)
      expect(json.settled ? Date.parse(json.settled) : null).toBe(ts)
      for (const r of json.rows) {
        const at = Date.parse(r.at)
        const o = owedAt(c.loan, c.payments, at)
        expect({ at: r.at, total: Number(r.total), hours: r.penalty_hours }).toEqual({ at: r.at, total: o.total, hours: o.hours })
        if (c.loan.interest_mode === 'daily') {
          const since = r.arrears_since ? Date.parse(r.arrears_since) : null
          expect(since).toBe(o.arrears?.since ?? null)
        }
        loanSnapshot(c.loan, c.payments, at) // ไม่ throw
      }
    })
  }
})
