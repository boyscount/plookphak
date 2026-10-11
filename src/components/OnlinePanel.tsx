// staff: ใครออนไลน์อยู่ / ใช้งานล่าสุด (super admin เห็นทุกคน, admin ไม่เห็น super admin — ฐานข้อมูลกรองให้)
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { presenceState, presenceText, usePresence } from '../lib/presence'
import { useProfiles } from '../lib/queries'
import { Avatar, Card, cx } from './ui'

const ROLE = { super_admin: 'Super admin', admin: 'Admin', borrower: 'ผู้ยืม' } as const
const DAY = 86_400_000

export function OnlinePanel() {
  const { profile } = useAuth()
  const presence = usePresence()
  const { data: people } = useProfiles()

  const rows = (people ?? [])
    .filter((p) => p.id !== profile?.id && presence.has(p.id))
    .map((p) => ({ p, row: presence.get(p.id)! }))
    .sort((a, b) => Number(b.row.online) - Number(a.row.online) || Date.parse(b.row.last_seen_at) - Date.parse(a.row.last_seen_at))
  const online = rows.filter((x) => x.row.online)
  const recent = rows.filter((x) => !x.row.online && Date.now() - Date.parse(x.row.last_seen_at) < 7 * DAY)

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">ใครออนไลน์อยู่</h3>
        <span className={cx('rounded-full px-3 py-1 text-sm font-semibold', online.length ? 'bg-emerald-100 text-ok' : 'bg-pill text-muted')}>
          ● {online.length} คน
        </span>
      </div>

      {online.length ? (
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {online.map(({ p }) => (
            <Link
              key={p.id}
              to={p.role === 'borrower' ? `/borrowers/${p.id}` : '/me'}
              className="flex w-16 shrink-0 flex-col items-center gap-1 text-center"
            >
              <Avatar name={p.aka} avatar={p.avatar} size="sm" presence="online" />
              <span className="w-full truncate text-xs font-semibold">{p.aka}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">ตอนนี้ไม่มีใครเปิดแอปอยู่</p>
      )}

      {recent.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-semibold text-muted">ใช้งานใน 7 วันที่ผ่านมา</p>
          <ul className="divide-y divide-line">
            {recent.slice(0, 12).map(({ p, row }) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <Avatar name={p.aka} avatar={p.avatar} size="xs" presence={presenceState(row)} />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {p.aka} <span className="text-xs text-muted">· {ROLE[p.role]}</span>
                </span>
                <span className="shrink-0 text-sm text-muted">{presenceText(row).replace('ใช้งาน', '')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted">อัปเดตทุก 30 วินาที · ออนไลน์ = เปิดแอปอยู่ตอนนี้</p>
    </Card>
  )
}
