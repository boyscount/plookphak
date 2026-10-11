import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProfileHeader } from '../components/AppShell'
import { BadgeRow } from '../components/Badges'
import { PayoffCalculatorSheet, RequestSheet } from '../components/BorrowerTools'
import { GoldCard } from '../components/GoldCard'
import { NextAction } from '../components/NextAction'
import { memberStats, TIER_LABEL, tierOf } from '../lib/tier'
import { LoanCard, StateBadge } from '../components/LoanCard'
import { PaymentList } from '../components/Payments'
import { SlipSheet } from '../components/SlipSheet'
import { EmptyState, NotebookArt, Pill, Row, Tabs, Card } from '../components/ui'
import { ListIcon, SlipIcon } from '../components/icons'
import { useAuth } from '../lib/auth'
import { fmtBaht } from '../lib/format'
import { loanSnapshot } from '../lib/loanMath'
import { useLoans, useNow } from '../lib/queries'
import { LoanCardSkeleton } from '../components/Skeleton'

type Tab = 'now' | 'history' | 'all'

/** ผู้ยืม: ดูได้อย่างเดียว ยกเว้นปุ่มอัปสลิปและส่ง */
export function BorrowerHome({ initialTab = 'now' }: { initialTab?: Tab }) {
  const { profile } = useAuth()
  const { data: loans, isLoading } = useLoans()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [calcOpen, setCalcOpen] = useState(false)
  const [reqOpen, setReqOpen] = useState(false)
  const now = useNow(1000)

  const payOpen = params.get('pay') === '1'
  const payLoan = params.get('loan')
  const setPayOpen = (v: boolean, loanId?: string) =>
    setParams(v ? { pay: '1', ...(loanId ? { loan: loanId } : {}) } : {}, { replace: true })

  const all = loans ?? []
  const snaps = all.map((l) => ({ loan: l, s: loanSnapshot(l, l.payments, now) }))
  const open = snaps.filter((x) => x.s.balance > 0 || x.s.state === 'pending_review')
  const closed = snaps.filter((x) => !open.includes(x))
  const totalBalance = open.reduce((s, x) => s + x.s.balance, 0)
  const overdue = open.some((x) => x.s.state === 'overdue')
  const payments = all.flatMap((l) => l.payments)
  const stats = memberStats(all, now)
  const tier = tierOf(stats)

  return (
    <div>
      <ProfileHeader
        name={profile?.aka ?? ''}
        avatar={profile?.avatar}
        cover={profile?.cover}
        subtitle={
          totalBalance > 0 ? (
            <span className={overdue ? 'font-semibold text-danger' : ''}>ค้างชำระ {fmtBaht(totalBalance)}</span>
          ) : (
            'ไม่มียอดค้าง'
          )
        }
      />
      {!isLoading && (
        <div className="mt-6 px-4 sm:px-6">
          <NextAction loans={all} now={now} onPay={(id) => setPayOpen(true, id)} />
        </div>
      )}
      <div className="mt-6 px-4 sm:px-6">
        <GoldCard
          name={profile?.aka ?? ''}
          seed={profile?.id ?? ''}
          variant={tier}
          tier={overdue ? `${TIER_LABEL[tier]} · OVERDUE` : `${TIER_LABEL[tier]} MEMBER`}
          caption={fmtBaht(totalBalance)}
        />
        <p className="mt-3 text-center text-xs text-muted">ปัดบัตรเพื่อหมุน · แตะเพื่อพลิก</p>
      </div>
      <div className="mt-4 px-4 sm:px-6">
        <BadgeRow stats={stats} />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 px-4 sm:px-6">
        <Pill icon={<SlipIcon />} onClick={() => setPayOpen(true)} tone={overdue ? 'brand' : 'gray'}>
          อัปสลิป
        </Pill>
        <Pill icon={<ListIcon />} onClick={() => setTab('history')}>
          ประวัติชำระ
        </Pill>
        <Pill onClick={() => setCalcOpen(true)}>🧮 คำนวณปิดยอด</Pill>
        <Pill onClick={() => setReqOpen(true)}>🙏 ขอเลื่อน/ผ่อน</Pill>
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
          <LoanCardSkeleton />
        ) : tab === 'now' ? (
          open.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {open.map(({ loan }) => (
                <LoanCard key={loan.id} loan={loan} />
              ))}
            </div>
          ) : (
            <EmptyLoanCard />
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
                <Row label="จำนวนเงินที่ต้องชำระ" value={fmtBaht(s.total)} />
                <Row label="คงเหลือ" value={fmtBaht(s.balance)} />
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="ไม่มีคอนเทนต์ในช่องนี้" subtitle="เงียบจังเลย…เงียบไปแล้ว…" />
        )}
      </div>

      <SlipSheet loans={all} open={payOpen} initialLoanId={payLoan} onClose={() => setPayOpen(false)} />
      <PayoffCalculatorSheet loans={all} open={calcOpen} onClose={() => setCalcOpen(false)} />
      <RequestSheet loans={all} open={reqOpen} onClose={() => setReqOpen(false)} />
    </div>
  )
}

const LOAN_FIELDS = [
  'จำนวนเงินที่ยืม',
  'วันที่ยืม',
  'วันที่เริ่มคิดดอกเบี้ย',
  'ดอกเบี้ยต่อวัน',
  'รวมดอกเบี้ยที่ต้องชำระ',
  'วันครบกำหนดชำระ',
  'ค่าปรับต่อชั่วโมง',
  'จำนวนเงินที่ต้องชำระ',
]

/** ไม่มียอดค้าง: แสดงหัวข้อของรายการยืมไว้ให้รู้ว่าจะเห็นอะไรบ้าง */
function EmptyLoanCard() {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <NotebookArt className="w-20 shrink-0" />
        <div>
          <p className="text-lg font-bold">ไม่มียอดค้างชำระ</p>
          <p className="text-sm text-muted">เมื่อมีรายการยืม ข้อมูลจะแสดงตรงนี้</p>
        </div>
      </div>
      <div className="mt-3 divide-y divide-line text-[15px]">
        {LOAN_FIELDS.map((f) => (
          <Row key={f} label={f} value={<span className="text-muted">–</span>} />
        ))}
      </div>
    </Card>
  )
}
