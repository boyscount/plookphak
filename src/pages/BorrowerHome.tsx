import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProfileHeader } from '../components/AppShell'
import { LoanCard, StateBadge } from '../components/LoanCard'
import { PaymentList, SlipSheet } from '../components/Payments'
import { EmptyState, Pill, Row, Spinner, Tabs, Card } from '../components/ui'
import { ListIcon, SlipIcon } from '../components/icons'
import { useAuth } from '../lib/auth'
import { fmtBaht } from '../lib/format'
import { loanSnapshot } from '../lib/loanMath'
import { useLoans, useNow } from '../lib/queries'

type Tab = 'now' | 'history' | 'all'

/** ผู้ยืม: ดูได้อย่างเดียว ยกเว้นปุ่มอัปสลิปและส่ง */
export function BorrowerHome({ initialTab = 'now' }: { initialTab?: Tab }) {
  const { profile } = useAuth()
  const { data: loans, isLoading } = useLoans()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(initialTab)
  const now = useNow(1000)

  const payOpen = params.get('pay') === '1'
  const setPayOpen = (v: boolean) => setParams(v ? { pay: '1' } : {}, { replace: true })

  const all = loans ?? []
  const snaps = all.map((l) => ({ loan: l, s: loanSnapshot(l, l.payments, now) }))
  const open = snaps.filter((x) => x.s.balance > 0 || x.s.state === 'pending_review')
  const closed = snaps.filter((x) => !open.includes(x))
  const totalBalance = open.reduce((s, x) => s + x.s.balance, 0)
  const overdue = open.some((x) => x.s.state === 'overdue')
  const payments = all.flatMap((l) => l.payments)

  return (
    <div>
      <ProfileHeader
        name={profile?.aka ?? ''}
        subtitle={
          totalBalance > 0 ? (
            <span className={overdue ? 'font-semibold text-danger' : ''}>ค้างชำระ {fmtBaht(totalBalance)}</span>
          ) : (
            'ไม่มียอดค้าง'
          )
        }
      />
      <div className="mt-6 grid grid-cols-2 gap-3 px-4 sm:px-6">
        <Pill icon={<SlipIcon />} onClick={() => setPayOpen(true)} tone={overdue ? 'brand' : 'gray'}>
          อัปสลิป
        </Pill>
        <Pill icon={<ListIcon />} onClick={() => setTab('history')}>
          ประวัติชำระ
        </Pill>
      </div>

      <div className="mt-6 px-4 sm:px-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'now', label: 'ยอดปัจจุบัน' },
            { id: 'history', label: 'ประวัติชำระ', badge: payments.filter((p) => p.status === 'pending').length },
            { id: 'all', label: 'รายการทั้งหมด' },
          ]}
        />
      </div>

      <div className="mt-4 space-y-4 px-4 sm:px-6">
        {isLoading ? (
          <Spinner />
        ) : tab === 'now' ? (
          open.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {open.map(({ loan }) => (
                <LoanCard key={loan.id} loan={loan} />
              ))}
            </div>
          ) : (
            <EmptyState title="ไม่มียอดค้างชำระ" subtitle="เงียบจังเลย…เงียบไปแล้ว…" />
          )
        ) : tab === 'history' ? (
          payments.length ? (
            <PaymentList payments={payments} />
          ) : (
            <EmptyState title="ยังไม่มีการชำระ" subtitle="อัปสลิปได้จากปุ่มด้านบน" />
          )
        ) : all.length ? (
          <div className="space-y-2">
            {[...open, ...closed].map(({ loan, s }) => (
              <Card key={loan.id}>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">{fmtBaht(Number(loan.principal))}</span>
                  <StateBadge state={s.state} />
                </div>
                <Row label="ยอดรวม" value={fmtBaht(s.total)} />
                <Row label="คงเหลือ" value={fmtBaht(s.balance)} />
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="ไม่มีคอนเทนต์ในช่องนี้" subtitle="เงียบจังเลย…เงียบไปแล้ว…" />
        )}
      </div>

      <SlipSheet loans={all} open={payOpen} onClose={() => setPayOpen(false)} />
    </div>
  )
}
