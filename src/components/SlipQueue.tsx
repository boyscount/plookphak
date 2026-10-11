// admin: คิวสลิปรอตรวจ — ปัดขวา = ผ่าน, ปัดซ้าย = ไม่ผ่าน, แตะ = เปิดดูสลิปเต็ม
// กดแล้วมีเวลา 5 วินาทีให้ "เลิกทำ" ก่อนบันทึกจริง (ยังไม่ส่งอะไรเข้าฐานข้อมูลจนครบเวลา)
import { useEffect, useRef, useState } from 'react'
import { fmtBaht, fmtDateTime } from '../lib/format'
import { must, signedSlipUrl, useRefreshMoney } from '../lib/queries'
import { errorText, supabase } from '../lib/supabase'
import type { Payment } from '../lib/types'
import { PaymentSheet } from './Payments'
import { toast } from './Toast'
import { cx } from './ui'

type Row = Payment & { aka?: string }
type Decision = 'approved' | 'rejected'

const UNDO_MS = 5000
const SWIPE_AT = 96

function SlipThumb({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (path) signedSlipUrl(path).then(setUrl, () => setUrl(null))
  }, [path])
  return (
    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-xl">
      {url ? <img src={url} alt="" className="size-full object-cover" /> : '🧾'}
    </span>
  )
}

function SwipeRow({ p, onDecide, onOpen }: { p: Row; onDecide: (d: Decision) => void; onOpen: () => void }) {
  const [dx, setDx] = useState(0)
  const drag = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null)
  const moved = useRef(false)

  return (
    <li className="relative overflow-hidden rounded-2xl">
      {/* พื้นหลังที่โผล่ตอนปัด */}
      <div
        aria-hidden
        className={cx(
          'absolute inset-0 flex items-center px-5 text-lg font-bold text-white',
          dx === 0 && 'invisible',
          dx >= 0 ? 'justify-start bg-[#0b8457]' : 'justify-end bg-[#d0262b]',
        )}
      >
        <span style={{ opacity: Math.min(1, Math.abs(dx) / SWIPE_AT) }}>{dx >= 0 ? '✓ ผ่าน' : 'ไม่ผ่าน ✕'}</span>
      </div>

      <div
        className={cx('relative flex items-center gap-3 bg-surface p-3', !drag.current && 'transition-transform duration-200')}
        style={{ transform: `translateX(${dx}px)`, touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null }
          moved.current = false
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d || d.id !== e.pointerId) return
          const mx = e.clientX - d.x
          const my = e.clientY - d.y
          if (d.horizontal === null && Math.hypot(mx, my) > 8) {
            d.horizontal = Math.abs(mx) > Math.abs(my)
            if (d.horizontal) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          }
          if (d.horizontal) {
            moved.current = true
            setDx(mx)
          }
        }}
        onPointerUp={() => {
          const d = drag.current
          drag.current = null
          if (!d?.horizontal) return setDx(0)
          if (dx > SWIPE_AT) onDecide('approved')
          else if (dx < -SWIPE_AT) onDecide('rejected')
          setDx(0)
        }}
        onPointerCancel={() => {
          drag.current = null
          setDx(0)
        }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => !moved.current && onOpen()}
        >
          <SlipThumb path={p.slip_path} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">
              {p.aka ? `${p.aka} · ` : ''}
              <span className="tabular">{fmtBaht(Number(p.amount))}</span>
            </span>
            <span className="block text-sm text-muted">{fmtDateTime(p.paid_at)}</span>
            {p.note && <span className="block truncate text-sm text-brand-700">{p.note}</span>}
            {!p.slip_ref && p.method === 'transfer' && <span className="block text-xs text-muted">⚠ อ่าน QR ไม่ได้ ดูรูปก่อน</span>}
          </span>
        </button>
        {/* ปุ่มสำหรับคอม/คนที่ไม่ถนัดปัด */}
        <div className="hidden shrink-0 gap-1.5 sm:flex">
          <button
            type="button"
            onClick={() => onDecide('approved')}
            className="grid size-10 place-items-center rounded-full bg-ok font-bold text-on-status"
            aria-label={`ผ่าน ${p.aka ?? ''} ${fmtBaht(Number(p.amount))}`}
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => onDecide('rejected')}
            className="grid size-10 place-items-center rounded-full bg-danger font-bold text-on-status"
            aria-label={`ไม่ผ่าน ${p.aka ?? ''} ${fmtBaht(Number(p.amount))}`}
          >
            ✕
          </button>
        </div>
      </div>
    </li>
  )
}

export function SlipQueue({ payments }: { payments: Row[] }) {
  const refresh = useRefreshMoney()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [viewing, setViewing] = useState<Row | null>(null)
  // รายการที่รอบันทึก: id → [ตัวตั้งเวลา, ฟังก์ชันบันทึก]
  const queued = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; commit: () => void }>())

  // ออกจากหน้า/ปิดแท็บ → บันทึกที่ค้างอยู่ทันที ไม่ให้หาย
  useEffect(() => {
    const map = queued.current
    const flush = () => {
      for (const [id, q] of map) {
        clearTimeout(q.timer)
        q.commit()
        map.delete(id)
      }
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  function decide(p: Row, status: Decision) {
    setHidden((h) => new Set(h).add(p.id))
    const commit = async () => {
      try {
        await must(supabase.from('payments').update({ status }).eq('id', p.id).eq('status', 'pending'))
      } catch (e) {
        setHidden((h) => {
          const n = new Set(h)
          n.delete(p.id)
          return n
        })
        toast({ text: `บันทึกไม่สำเร็จ: ${errorText(e)}`, tone: 'danger' })
      } finally {
        refresh()
      }
    }
    const timer = setTimeout(() => {
      queued.current.delete(p.id)
      commit()
    }, UNDO_MS)
    queued.current.set(p.id, { timer, commit })
    toast(
      {
        text: `${status === 'approved' ? 'ผ่าน' : 'ไม่ผ่าน'} · ${p.aka ?? ''} ${fmtBaht(Number(p.amount))}`,
        tone: status === 'approved' ? 'ok' : 'danger',
        action: {
          label: 'เลิกทำ',
          run: () => {
            clearTimeout(timer)
            queued.current.delete(p.id)
            setHidden((h) => {
              const n = new Set(h)
              n.delete(p.id)
              return n
            })
          },
        },
      },
      UNDO_MS,
    )
  }

  const visible = [...payments]
    .filter((p) => !hidden.has(p.id))
    .sort((a, b) => Date.parse(a.paid_at) - Date.parse(b.paid_at))

  if (!visible.length) {
    return <p className="py-10 text-center text-muted">ตรวจครบทุกใบแล้ว ☕</p>
  }
  return (
    <div>
      <p className="mb-2 px-1 text-sm text-muted">
        <span className="sm:hidden">ปัดขวา = ผ่าน · ปัดซ้าย = ไม่ผ่าน · </span>แตะเพื่อดูสลิปเต็ม
      </p>
      <ul className="space-y-2">
        {visible.map((p) => (
          <SwipeRow key={p.id} p={p} onDecide={(d) => decide(p, d)} onOpen={() => setViewing(p)} />
        ))}
      </ul>
      {viewing && <PaymentSheet payment={viewing} canReview onClose={() => setViewing(null)} />}
    </div>
  )
}
