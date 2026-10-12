import { AvatarArt } from './avatars'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

/** ปุ่มทรงแคปซูลสีเทาแบบในรูปโปรไฟล์ */
export function Pill({
  icon,
  children,
  tone = 'gray',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode
  tone?: 'gray' | 'brand' | 'dark' | 'danger' | 'ok'
}) {
  const tones = {
    gray: 'bg-pill text-ink hover:bg-pill-hover',
    brand: 'bg-brand-600 text-white hover:bg-brand-700',
    dark: 'bg-brand-900 text-white hover:bg-black',
    danger: 'bg-danger text-on-status hover:brightness-95',
    ok: 'bg-ok text-on-status hover:brightness-95',
  }
  return (
    <button
      type="button"
      className={cx(
        'inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full px-5 text-[15px] font-semibold transition active:scale-[.98] disabled:opacity-50',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export function Avatar({
  name,
  avatar,
  size = 'lg',
  onClick,
  presence,
}: {
  name: string
  avatar?: string | null
  size?: 'xs' | 'sm' | 'lg'
  onClick?: () => void
  /** จุดสถานะ: online = เขียว, recent = เหลือง (ใช้งานไม่นานนี้) */
  presence?: 'online' | 'recent' | null
}) {
  const cls = cx(
    'block shrink-0 rounded-full',
    size === 'lg' && 'avatar-3d size-28 ring-4 ring-canvas sm:size-32',
    size === 'sm' && 'size-11',
    size === 'xs' && 'size-7',
  )
  const dot = presence && (
    <span
      role="img"
      aria-label={presence === 'online' ? 'ออนไลน์อยู่' : 'ใช้งานไม่นานนี้'}
      className={cx(
        'absolute rounded-full ring-canvas',
        presence === 'online' ? 'bg-[#22c55e]' : 'bg-[#f5b301]',
        size === 'lg' ? 'top-1 right-1 size-6 ring-4' : size === 'sm' ? 'right-0 bottom-0 size-3.5 ring-2' : 'right-0 bottom-0 size-2.5 ring-2',
      )}
    />
  )
  const art = (
    <>
      <AvatarArt id={avatar} className="size-full" />
      {dot}
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(cls, 'relative active:scale-95')} aria-label={`เปลี่ยนรูปโปรไฟล์ของ ${name}`}>
      {art}
      <span className="absolute right-0 bottom-0 grid size-9 place-items-center rounded-full bg-brand-900 text-base text-white ring-4 ring-canvas">
        ✎
      </span>
    </button>
  ) : (
    <span className={cx(cls, dot && 'relative')} title={name}>
      {art}
    </span>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; badge?: number }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-7 overflow-x-auto px-4 sm:gap-10" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            'relative shrink-0 pb-2.5 text-[17px] font-semibold whitespace-nowrap',
            value === t.id ? 'text-brand-700' : 'text-ink',
          )}
        >
          {t.label}
          {!!t.badge && (
            <span className="ml-1.5 rounded-full bg-danger px-1.5 text-xs text-on-status">{t.badge}</span>
          )}
          {value === t.id && <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-brand-600" />}
        </button>
      ))}
    </div>
  )
}

/** โลโก้: สมุดจด + เหรียญบาท (ใช้ลายเดียวกับ public/favicon.svg) */
export function Logo({ className = 'size-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect x="15" y="7" width="34" height="44" rx="5" fill="#fff" stroke="#0e0e10" strokeWidth="4" />
      <path d="M23 18h18M23 26h18M23 34h10" stroke="#d9d6e3" strokeWidth="4" strokeLinecap="round" />
      {[13, 23, 33, 43].map((y) => (
        <rect key={y} x="10" y={y} width="10" height="5" rx="2.5" fill="#a372ff" stroke="#0e0e10" strokeWidth="2.5" />
      ))}
      <circle cx="45" cy="45" r="13" fill="#ffc95c" stroke="#0e0e10" strokeWidth="4" />
      <path d="M41 38v14M41 38h5a3.5 3.5 0 0 1 0 7h-5M41 45h6a3.5 3.5 0 0 1 0 7h-6M44 35v20" fill="none" stroke="#0e0e10" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** ภาพประกอบตอนว่าง: สมุดจดกับดินสอบนพื้นม่วง */
export function NotebookArt({ className = 'w-56' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 160" className={className} aria-hidden>
      <path d="M40 40 C70 10 170 5 200 20 L185 60 L200 75 C170 120 110 130 70 120 Z" fill="#8a4bff" />
      <g transform="rotate(-8 105 85)">
        {/* สมุด: เงาเหลือง + ปกดำ + หน้ากระดาษ */}
        <rect x="58" y="34" width="96" height="112" rx="8" fill="#ffe14d" />
        <rect x="52" y="28" width="96" height="112" rx="8" fill="#18181b" />
        <rect x="64" y="36" width="78" height="96" rx="4" fill="#fff" />
        {[56, 72, 88, 104, 120].map((y) => (
          <rect key={y} x="74" y={y} width={y === 120 ? 34 : 58} height="5" rx="2.5" fill="#d9d6e3" />
        ))}
        {/* ห่วงสันสมุด */}
        {[44, 64, 84, 104, 124].map((y) => (
          <rect key={y} x="46" y={y} width="14" height="7" rx="3.5" fill="#8a4bff" stroke="#18181b" strokeWidth="2.5" />
        ))}
      </g>
      {/* ดินสอ */}
      <g transform="rotate(38 160 92)">
        <rect x="150" y="30" width="20" height="92" rx="3" fill="#ffc95c" stroke="#18181b" strokeWidth="4" />
        <rect x="150" y="30" width="20" height="16" rx="3" fill="#ff8fb1" stroke="#18181b" strokeWidth="4" />
        <path d="M150 122 L160 146 L170 122 Z" fill="#fff3d6" stroke="#18181b" strokeWidth="4" strokeLinejoin="round" />
        <path d="M156.5 138 L160 146 L163.5 138 Z" fill="#18181b" />
      </g>
    </svg>
  )
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <NotebookArt />
      <p className="mt-6 text-xl font-semibold text-muted">{title}</p>
      {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
    </div>
  )
}

/** หน้าต่างเลื่อนขึ้นจากล่างบนมือถือ / กลางจอบน iPad */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className="pb-safe max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-pill sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-pill" aria-label="ปิด">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        'h-12 w-full rounded-2xl border-2 border-transparent bg-pill px-4 text-base outline-none focus:border-brand-500 focus:bg-surface',
        props.className,
      )}
    />
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('card-depth rounded-3xl p-4 sm:p-5', className)}>{children}</div>
}

export function ErrorText({ error }: { error?: string | null }) {
  if (!error) return null
  return <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>
}

export function Spinner() {
  return (
    <div className="grid place-items-center py-20">
      <div className="size-9 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
    </div>
  )
}

export function Row({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-muted">{label}</span>
      <span className={cx('tabular text-right', strong ? 'text-lg font-bold' : 'font-medium')}>{value}</span>
    </div>
  )
}
