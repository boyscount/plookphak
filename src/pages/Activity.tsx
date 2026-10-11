import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, cx } from '../components/ui'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/format'
import { useLoans, useMarkAllRead, useNotifications } from '../lib/queries'
import { RowsSkeleton } from '../components/Skeleton'

export function Activity() {
  const { isStaff } = useAuth()
  const navigate = useNavigate()
  const { data, isLoading } = useNotifications()
  const { data: loans } = useLoans()
  const markRead = useMarkAllRead()
  const hasUnread = data?.some((n) => !n.read_at)

  // เปิดหน้านี้แล้วถือว่าอ่านแล้ว แต่ยังไฮไลต์รายการใหม่ไว้จนกว่าจะออกจากหน้า
  useEffect(() => {
    if (hasUnread) {
      const t = setTimeout(() => markRead.mutate(), 1500)
      return () => clearTimeout(t)
    }
  }, [hasUnread]) // eslint-disable-line react-hooks/exhaustive-deps

  function open(loanId: string | null) {
    if (!loanId) return
    if (!isStaff) return navigate('/')
    const loan = loans?.find((l) => l.id === loanId)
    if (loan) navigate(`/borrowers/${loan.borrower_id}`)
  }

  return (
    <div className="pt-safe px-4 sm:px-6">
      <h1 className="pt-4 text-3xl font-bold">กิจกรรม</h1>
      <div className="mt-4">
        {isLoading ? (
          <RowsSkeleton />
        ) : !data?.length ? (
          <EmptyState title="ยังไม่มีการแจ้งเตือน" subtitle="เงียบจังเลย…เงียบไปแล้ว…" />
        ) : (
          <ul className="space-y-2">
            {data.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => open(n.loan_id)}
                  className={cx('flex w-full gap-3 rounded-2xl p-3.5 text-left', n.read_at ? 'bg-surface' : 'bg-brand-50')}
                >
                  <span className={cx('mt-2 size-2.5 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-[#ff6fd1]')} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{n.title}</span>
                    {n.body && <span className="block text-muted">{n.body}</span>}
                    <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
