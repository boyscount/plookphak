import { cx, Logo } from './ui'

/** เลขบัตรหลอกจาก id (4 หลักท้ายคงที่ต่อคน) */
function last4(seed: string) {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return String(h % 10000).padStart(4, '0')
}

function Chip() {
  return (
    <svg viewBox="0 0 50 38" className="h-[30px] w-[40px] shrink-0" aria-hidden>
      <defs>
        <linearGradient id="chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff4c9" />
          <stop offset=".5" stopColor="#d9b25a" />
          <stop offset="1" stopColor="#a8822e" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="48" height="36" rx="7" fill="url(#chip)" stroke="#7a5a17" strokeWidth="1.2" />
      <path d="M1 13h15M1 25h15M34 13h15M34 25h15M16 1v36M34 1v36M16 19h18" stroke="#7a5a17" strokeWidth="1.2" fill="none" />
    </svg>
  )
}

function Contactless() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 opacity-70" fill="none" stroke="#5c4310" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M8 8a6 6 0 0 1 0 8M12 5.5a10 10 0 0 1 0 13M16 3a14 14 0 0 1 0 18" />
    </svg>
  )
}

/**
 * บัตรทองหมุนช้า ๆ (3D) — หน้าบัตร: ชิป, เลขบัตร, ชื่อ / หลังบัตร: แถบแม่เหล็ก, ลายเซ็น
 * ผู้ใช้ที่ตั้งลดการเคลื่อนไหวไว้ จะเห็นบัตรเอียงนิ่ง ๆ
 */
export function GoldCard({
  name,
  seed,
  tier = 'GOLD MEMBER',
  caption,
  className,
}: {
  name: string
  seed: string
  tier?: string
  caption?: string
  className?: string
}) {
  const num = last4(seed || name || 'plookphak')
  return (
    <div className={cx('gold-stage mx-auto w-full max-w-[340px]', className)}>
      <div className="gold-spin relative aspect-[1.586] w-full">
        {/* หน้าบัตร */}
        <div className="gold-face gold-surface absolute inset-0 flex flex-col justify-between rounded-[18px] p-[6%]">
          <div className="gold-shine" />
          <div className="relative flex items-start justify-between">
            <span className="flex items-center gap-1.5">
              <Logo className="size-6" />
              <span className="gold-emboss text-[15px] font-bold tracking-wide">Plookphak</span>
            </span>
            <span className="gold-emboss text-[10px] font-semibold tracking-[.2em]">{tier}</span>
          </div>
          <div className="relative flex items-center gap-3">
            <Chip />
            <Contactless />
          </div>
          <div className="relative">
            <p className="gold-emboss tabular text-[clamp(13px,4.6vw,18px)] leading-tight font-semibold tracking-[.12em]">
              •••• •••• •••• {num}
            </p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <span className="min-w-0">
                <span className="gold-emboss block text-[8px] tracking-[.2em] opacity-70">CARD HOLDER</span>
                <span className="gold-emboss block truncate text-[13px] font-semibold uppercase tracking-wider">{name || 'YOUR NAME'}</span>
              </span>
              {caption && (
                <span className="shrink-0 text-right">
                  <span className="gold-emboss block text-[8px] tracking-[.2em] opacity-70">BALANCE</span>
                  <span className="gold-emboss tabular block text-[13px] font-bold">{caption}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* หลังบัตร */}
        <div className="gold-face gold-back gold-surface absolute inset-0 overflow-hidden rounded-[18px]">
          <div className="gold-shine" />
          <div className="mt-[8%] h-[18%] bg-[#1b1406]" />
          <div className="mx-[6%] mt-[5%] flex items-center gap-2">
            <div className="h-8 flex-1 rounded bg-[repeating-linear-gradient(135deg,#fffbe8_0_6px,#f1e3b0_6px_12px)] px-2 text-right font-serif text-sm leading-8 italic text-[#5c4310]">
              {name}
            </div>
            <div className="grid h-8 w-12 place-items-center rounded bg-white text-xs font-bold text-[#5c4310] italic">{num.slice(1)}</div>
          </div>
          <p className="gold-emboss mx-[6%] mt-[4%] text-[9px] leading-snug opacity-80">
            บัตรนี้ใช้แสดงสถานะสมาชิกใน Plookphak เท่านั้น ไม่ใช่บัตรชำระเงินจริง
          </p>
          <div className="absolute right-[6%] bottom-[7%] flex items-center gap-1.5">
            <Logo className="size-6" />
            <span className="gold-emboss text-[11px] font-bold">Plookphak</span>
          </div>
        </div>
      </div>
    </div>
  )
}
