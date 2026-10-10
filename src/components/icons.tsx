// ไอคอนเส้นหนาแบบในรูปต้นแบบ
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

type P = { className?: string }

export const HomeIcon = ({ className = 'size-7' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
  </svg>
)
export const SearchIcon = ({ className = 'size-7' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </svg>
)
export const PlusIcon = ({ className = 'size-7' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={2.6}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const BellIcon = ({ className = 'size-7' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
  </svg>
)
export const GearIcon = ({ className = 'size-7' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    <circle cx="12" cy="12" r="7" />
  </svg>
)
export const SlipIcon = ({ className = 'size-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />
  </svg>
)
export const ChartIcon = ({ className = 'size-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
    <path d="M9 16v-3M12 16V9M15 16v-5" />
  </svg>
)
export const CashIcon = ({ className = 'size-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 9.5v5M18 9.5v5" />
  </svg>
)
export const KeyIcon = ({ className = 'size-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <circle cx="8" cy="15" r="4" />
    <path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2" />
  </svg>
)
export const LiveIcon = ({ className = 'size-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
)
export const ShieldIcon = ({ className = 'size-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z" />
  </svg>
)
export const ListIcon = ({ className = 'size-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
)
export const BackIcon = ({ className = 'size-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={2.6}>
    <path d="M15 5 8 12l7 7" />
  </svg>
)
export const LogoutIcon = ({ className = 'size-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
  </svg>
)
export const CatIcon = ({ className = 'size-7' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M4 20V9l3-5 3 4h4l3-4 3 5v11z" />
    <path d="M9 13h.01M15 13h.01M10.5 16.5q1.5 1 3 0" />
  </svg>
)
