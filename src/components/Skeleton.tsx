// โครงหน้าระหว่างโหลด — วางรูปทรงเดียวกับของจริง จอไม่กระโดดตอนข้อมูลมา และรู้สึกเร็วกว่าวงกลมหมุน
import { cx } from './ui'

export function Skel({ className }: { className?: string }) {
  return <div aria-hidden className={cx('skel', !className?.includes('rounded') && 'rounded-xl', className)} />
}

function Loading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-label="กำลังโหลด" className={className}>
      {children}
    </div>
  )
}

/** รายการแถว (กิจกรรม, สลิป, บันทึกระบบ, admin) */
export function RowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Loading className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-3xl bg-surface p-4">
          <Skel className="size-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skel className="h-4 w-2/5" />
            <Skel className="h-3 w-3/4" />
          </div>
          <Skel className="h-5 w-16" />
        </div>
      ))}
    </Loading>
  )
}

/** การ์ดผู้ยืมแบบตาราง (ตรงกับ BorrowerTile 3:4) */
export function TilesSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Loading className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skel className="aspect-[3/4] rounded-2xl" />
          <Skel className="mt-2 h-4 w-3/5" />
        </div>
      ))}
    </Loading>
  )
}

/** การ์ดรายการยืม (ยอด + นับถอยหลัง + ต้นซากุระ) */
export function LoanCardSkeleton() {
  return (
    <Loading className="space-y-4 rounded-3xl bg-surface p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skel className="h-3 w-28" />
          <Skel className="h-8 w-40" />
        </div>
        <Skel className="h-7 w-20 rounded-full" />
      </div>
      <Skel className="h-32 rounded-3xl" />
      <Skel className="h-24 rounded-3xl" />
    </Loading>
  )
}

/** ทั้งหน้า: ปก + รูปโปรไฟล์ + การ์ด (ตอนเปิดแอปเช็คการเข้าสู่ระบบ) */
export function PageSkeleton() {
  return (
    <Loading className="mx-auto max-w-5xl">
      <Skel className="h-40 rounded-none sm:h-48 sm:rounded-b-[2rem]" />
      <div className="relative -mt-12 flex items-end gap-4 px-4 sm:-mt-14 sm:px-6">
        <Skel className="size-28 shrink-0 rounded-full ring-4 ring-canvas sm:size-32" />
        <div className="flex-1 space-y-2 pb-3">
          <Skel className="h-7 w-2/5" />
          <Skel className="h-4 w-1/4" />
        </div>
      </div>
      <div className="mt-6 space-y-4 px-4 sm:px-6">
        <Skel className="h-44 rounded-3xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skel className="h-12 rounded-full" />
          <Skel className="h-12 rounded-full" />
        </div>
        <LoanCardSkeleton />
      </div>
    </Loading>
  )
}

/** ฉาก 3D (บ้านแมว / เรือนน้ำชา) ระหว่างโหลด three.js */
export function SceneSkeleton({ label = 'กำลังจัดฉาก…' }: { label?: string }) {
  return (
    <Loading className="pt-safe px-4 sm:px-6">
      <div className="flex items-center gap-3 pt-2">
        <Skel className="size-11 rounded-full" />
        <div className="space-y-2">
          <Skel className="h-6 w-40" />
          <Skel className="h-3 w-24" />
        </div>
      </div>
      <div className="skel mt-3 grid h-[62dvh] min-h-[360px] place-items-center rounded-3xl text-sm font-semibold text-muted">{label}</div>
    </Loading>
  )
}
