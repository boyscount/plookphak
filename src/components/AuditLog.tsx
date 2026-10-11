// บันทึกระบบ (super admin): แบ่งหน้า, กรองตามประเภท/การกระทำ/คน, จัดกลุ่มตามวัน, ชื่อช่องอ่านง่าย
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ACTION_LABEL, ACTION_TONE, auditDetail, TABLE_LABEL, type AuditRow } from '../lib/auditFormat'
import { useProfiles } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { cx, EmptyState } from './ui'
import { RowsSkeleton } from './Skeleton'

const PAGE = 30
const dayFmt = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const timeFmt = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })

const TABLE_FILTERS: [string, string][] = [['', 'ทั้งหมด'], ...Object.entries(TABLE_LABEL)]

export function AuditLog() {
  const { data: people } = useProfiles()
  const [page, setPage] = useState(0)
  const [table, setTable] = useState('')
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['audit', page, table, action, actor],
    queryFn: async () => {
      let q = supabase.from('audit_log').select('*', { count: 'exact' }).order('at', { ascending: false })
      if (table) q = q.eq('table_name', table)
      if (action) q = q.eq('action', action)
      if (actor === 'system') q = q.is('actor', null)
      else if (actor) q = q.eq('actor', actor)
      const { data, count, error } = await q.range(page * PAGE, page * PAGE + PAGE - 1)
      if (error) throw error
      return { rows: (data ?? []) as AuditRow[], count: count ?? 0 }
    },
    // เปลี่ยนหน้าแล้วยังเห็นหน้าเดิมจนกว่าหน้าใหม่มา ไม่กระพริบเป็นหน้าว่าง
    placeholderData: keepPreviousData,
  })

  const name = (id: string | null) => (id ? (people?.find((p) => p.id === id)?.aka ?? 'ไม่ทราบ') : 'ระบบ')
  const total = data?.count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const filtered = !!(table || action || actor)
  const withReset = (fn: () => void) => {
    fn()
    setPage(0)
  }

  // จัดกลุ่มตามวัน (เวลาไทย)
  const groups: { day: string; rows: AuditRow[] }[] = []
  for (const r of data?.rows ?? []) {
    const day = dayFmt.format(new Date(r.at))
    const last = groups[groups.length - 1]
    if (last?.day === day) last.rows.push(r)
    else groups.push({ day, rows: [r] })
  }

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        {TABLE_FILTERS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => withReset(() => setTable(k))}
            className={cx('shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold', table === k ? 'bg-brand-600 text-white' : 'bg-surface')}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          className="h-11 rounded-2xl bg-surface px-3 text-sm"
          value={action}
          onChange={(e) => withReset(() => setAction(e.target.value))}
          aria-label="การกระทำ"
        >
          <option value="">ทุกการกระทำ</option>
          {Object.entries(ACTION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="h-11 rounded-2xl bg-surface px-3 text-sm"
          value={actor}
          onChange={(e) => withReset(() => setActor(e.target.value))}
          aria-label="คนที่ทำ"
        >
          <option value="">ทุกคน</option>
          <option value="system">ระบบ (อัตโนมัติ)</option>
          {(people ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.aka}
              {p.role === 'borrower' ? ' (ผู้ยืม)' : ''}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <RowsSkeleton count={6} />
      ) : !data?.rows.length ? (
        <EmptyState title="ไม่พบบันทึก" subtitle={filtered ? 'ลองเปลี่ยนตัวกรอง' : undefined} />
      ) : (
        <div className={cx('space-y-4 transition-opacity', isFetching && 'opacity-60')}>
          {groups.map((g) => (
            <section key={g.day}>
              <h4 className="mb-2 px-1 text-sm font-bold text-muted">{g.day}</h4>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
                {g.rows.map((r) => {
                  const detail = auditDetail(r)
                  return (
                    <li key={r.id} className="flex gap-3 p-3.5">
                      <span className="tabular w-11 shrink-0 pt-0.5 text-xs text-muted">{timeFmt.format(new Date(r.at))}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">{name(r.actor)}</span>
                          <span className={cx('rounded-full px-2 py-0.5 text-xs font-bold', ACTION_TONE[r.action])}>
                            {ACTION_LABEL[r.action] ?? r.action}
                          </span>
                          <span className="text-sm">{TABLE_LABEL[r.table_name] ?? r.table_name}</span>
                        </span>
                        {detail.length > 0 && <span className="mt-1 block text-sm break-words text-muted">{detail.join(' · ')}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {total > PAGE && (
        <nav className="flex items-center justify-between gap-2 rounded-2xl bg-surface p-2" aria-label="แบ่งหน้า">
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-30"
              disabled={page === 0}
              onClick={() => setPage(0)}
              aria-label="หน้าแรก"
            >
              «
            </button>
            <button
              type="button"
              className="rounded-xl bg-pill px-3 py-2 text-sm font-semibold disabled:opacity-30"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              ‹ ก่อนหน้า
            </button>
          </div>
          <span className="tabular text-center text-sm text-muted">
            หน้า <b className="text-ink">{page + 1}</b>/{pages}
            <span className="block text-xs">{total.toLocaleString('th-TH')} รายการ</span>
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded-xl bg-pill px-3 py-2 text-sm font-semibold disabled:opacity-30"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              ถัดไป ›
            </button>
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-30"
              disabled={page >= pages - 1}
              onClick={() => setPage(pages - 1)}
              aria-label="หน้าสุดท้าย"
            >
              »
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}
