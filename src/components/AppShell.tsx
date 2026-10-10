import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useNotifications } from '../lib/queries'
import { Avatar, cx } from './ui'
import { BellIcon, HomeIcon, PlusIcon, SearchIcon } from './icons'

/** เมนูล่าง 5 ช่องแบบในรูปต้นแบบ */
export function AppShell() {
  const { isStaff, profile } = useAuth()
  const navigate = useNavigate()
  const { data: notes } = useNotifications()
  const unread = notes?.filter((n) => !n.read_at).length ?? 0

  const item = (to: string, label: string, icon: React.ReactNode, badge = false) => (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cx('relative flex flex-1 flex-col items-center gap-0.5 pt-2 text-[13px] font-semibold', isActive ? 'text-brand-600' : 'text-ink')
      }
    >
      {icon}
      {badge && <span className="absolute top-1.5 left-1/2 ml-2 size-2.5 rounded-full bg-[#ff6fd1]" />}
      {label}
    </NavLink>
  )

  return (
    <div className="mx-auto min-h-dvh max-w-5xl pb-28">
      <Outlet />
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-[#0000000f] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-start px-2">
          {item('/', 'หน้าแรก', <HomeIcon />)}
          {item('/browse', isStaff ? 'เรียกดู' : 'ประวัติ', <SearchIcon />)}
          <div className="flex flex-1 justify-center pt-2">
            <button
              onClick={() => navigate(isStaff ? '/borrowers/new' : '/?pay=1')}
              aria-label={isStaff ? 'เพิ่มผู้ยืม' : 'ส่งสลิป'}
              className="relative grid h-12 w-[86px] place-items-center rounded-full bg-pill active:scale-95"
            >
              <PlusIcon />
              <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-[#ff6fd1]" />
            </button>
          </div>
          {item('/activity', 'กิจกรรม', <BellIcon />, unread > 0)}
          <NavLink
            to="/me"
            className={({ isActive }) =>
              cx('flex flex-1 flex-col items-center gap-0.5 pt-2 text-[13px] font-semibold', isActive ? 'text-brand-600' : 'text-ink')
            }
          >
            {({ isActive }) => (
              <>
                <span className={cx('rounded-full', isActive && 'ring-2 ring-brand-600 ring-offset-1')}>
                  <Avatar name={profile?.aka ?? ''} avatar={profile?.avatar} size="xs" />
                </span>
                โปรไฟล์
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </div>
  )
}

/** แถบม่วงด้านบน + avatar เหลือง + ชื่อ แบบหน้าโปรไฟล์ในรูป */
export function ProfileHeader({
  name,
  avatar,
  onAvatarClick,
  subtitle,
  left,
  right,
}: {
  name: string
  avatar?: string | null
  onAvatarClick?: () => void
  subtitle?: React.ReactNode
  left?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <header>
      <div className="pt-safe h-36 bg-gradient-to-b from-[#5a2fb8] to-[#8b4cff] px-4 sm:h-44 sm:rounded-b-[2rem]">
        <div className="flex items-center justify-between pt-2">
          <div>{left}</div>
          <div>{right}</div>
        </div>
      </div>
      <div className="-mt-10 flex items-center gap-4 px-4 sm:-mt-12 sm:px-6">
        <Avatar name={name} avatar={avatar} onClick={onAvatarClick} />
        <div className="min-w-0 pt-8">
          <h1 className="truncate text-[28px] leading-tight font-bold sm:text-4xl">{name}</h1>
          {subtitle && <div className="mt-0.5 text-muted">{subtitle}</div>}
        </div>
      </div>
    </header>
  )
}

export function RoundButton({ children, onClick, label }: { children: React.ReactNode; onClick?: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} className="grid size-14 place-items-center rounded-full bg-brand-900 text-white active:scale-95">
      {children}
    </button>
  )
}

export function DarkPill({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="h-11 rounded-full bg-brand-900 px-4 text-[15px] font-semibold text-white active:scale-95">
      {children}
    </button>
  )
}
