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
    gray: 'bg-pill text-ink hover:bg-[#dcdce3]',
    brand: 'bg-brand-600 text-white hover:bg-brand-700',
    dark: 'bg-brand-900 text-white hover:bg-black',
    danger: 'bg-danger text-white hover:brightness-95',
    ok: 'bg-ok text-white hover:brightness-95',
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

export function Avatar({ name, size = 'lg' }: { name: string; size?: 'sm' | 'lg' }) {
  const big = size === 'lg'
  return (
    <div
      className={cx(
        'grid shrink-0 place-items-center rounded-full bg-sun',
        big ? 'size-28 ring-4 ring-canvas sm:size-32' : 'size-11',
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className={big ? 'size-16 sm:size-20' : 'size-6'} fill="none" stroke="#0e0e10" strokeWidth="2.6">
        <circle cx="12" cy="8.5" r="4.2" />
        <path d="M4.5 21v-1.8a5.5 5.5 0 0 1 5.5-5.5h4a5.5 5.5 0 0 1 5.5 5.5V21" strokeLinecap="round" />
      </svg>
      <span className="sr-only">{name}</span>
    </div>
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
            value === t.id ? 'text-brand-600' : 'text-ink',
          )}
        >
          {t.label}
          {!!t.badge && (
            <span className="ml-1.5 rounded-full bg-danger px-1.5 text-xs text-white">{t.badge}</span>
          )}
          {value === t.id && <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-brand-600" />}
        </button>
      ))}
    </div>
  )
}

/** ภาพประกอบตอนว่าง แบบม้วนฟิล์มบนพื้นม่วง */
export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <svg viewBox="0 0 220 160" className="w-56" aria-hidden>
        <path d="M40 40 C70 10 170 5 200 20 L185 60 L200 75 C170 120 110 130 70 120 Z" fill="#8a4bff" />
        <g transform="rotate(-12 110 90)">
          <rect x="50" y="45" width="120" height="90" rx="6" fill="#ffe14d" />
          <rect x="46" y="40" width="120" height="90" rx="6" fill="#18181b" />
          <rect x="70" y="52" width="72" height="66" rx="3" fill="#fff" />
          <path d="M98 72 L120 85 L98 98 Z" fill="#18181b" />
          {[52, 70, 88, 106].map((y) => (
            <g key={y}>
              <rect x="53" y={y} width="9" height="9" rx="2" fill="#fff" />
              <rect x="150" y={y} width="9" height="9" rx="2" fill="#8a4bff" />
            </g>
          ))}
        </g>
      </svg>
      <p className="mt-6 text-xl font-semibold text-[#5b5b66]">{title}</p>
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
        className="pb-safe max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 sm:max-w-lg sm:rounded-3xl"
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
      <span className="mb-1.5 block text-sm font-semibold text-[#3a3a44]">{label}</span>
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
        'h-12 w-full rounded-2xl border-2 border-transparent bg-pill px-4 text-base outline-none focus:border-brand-500 focus:bg-white',
        props.className,
      )}
    />
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-3xl bg-white p-4 shadow-[0_1px_0_#0000000d] sm:p-5', className)}>{children}</div>
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
