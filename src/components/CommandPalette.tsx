// ค้นหาด่วน (admin): Ctrl+K / ⌘K / "/" หรือปุ่ม 🔍 — พิมพ์ชื่อแล้วกระโดดไปหน้าคนนั้น หรือเลือกคำสั่งลัด
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtBaht } from '../lib/format'
import { loanSnapshot } from '../lib/loanMath'
import { useLoans, useProfiles } from '../lib/queries'
import { Avatar, cx } from './ui'
import { presenceState, usePresence } from '../lib/presence'

const OPEN_EVENT = 'plookphak:palette'
const RECENT_KEY = 'plookphak:palette-recent'

/** เปิดหน้าค้นหาจากปุ่มที่ไหนก็ได้ */
export const openPalette = () => window.dispatchEvent(new Event(OPEN_EVENT))

type Item = {
  id: string
  label: string
  hint?: string
  icon: React.ReactNode
  to: string
  keywords: string
  late?: boolean
}

const ACTIONS: Omit<Item, 'icon'>[] = [
  { id: 'a:new', label: 'เพิ่มผู้ยืม', to: '/borrowers/new', keywords: 'เพิ่ม ผู้ยืม ใหม่ new add' },
  { id: 'a:slips', label: 'สลิปรอตรวจ', to: '/?tab=slips', keywords: 'สลิป ตรวจ slip review' },
  { id: 'a:req', label: 'คำขอเลื่อน/ผ่อน', to: '/?tab=requests', keywords: 'คำขอ เลื่อน ผ่อน request' },
  { id: 'a:all', label: 'ผู้ยืมทั้งหมด', to: '/browse', keywords: 'ทั้งหมด รายชื่อ browse list' },
  { id: 'a:house', label: 'เรือนน้ำชา', to: '/building', keywords: 'เรือน น้ำชา 3d teahouse building' },
  { id: 'a:me', label: 'โปรไฟล์ / ตั้งค่า / backup', to: '/me', keywords: 'โปรไฟล์ ตั้งค่า สำรอง backup export settings' },
]
const ACTION_ICON: Record<string, string> = { 'a:new': '➕', 'a:slips': '📩', 'a:req': '🙏', 'a:all': '📚', 'a:house': '🏯', 'a:me': '⚙️' }

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}
function pushRecent(id: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, 5)))
  } catch {
    /* ไม่มี storage ก็ไม่เป็นไร */
  }
}

export function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const { data: people } = useProfiles('borrower')
  const { data: loans } = useLoans()
  const presence = usePresence()

  useEffect(() => {
    const show = () => {
      setQ('')
      setActive(0)
      setOpen(true)
    }
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]')
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        show()
      } else if (e.key === '/' && !typing) {
        e.preventDefault()
        show()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_EVENT, show)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_EVENT, show)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => input.current?.focus())
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const all = useMemo<Item[]>(() => {
    if (!open) return []
    const now = Date.now()
    const borrowers = (people ?? []).map((p) => {
      const mine = (loans ?? []).filter((l) => l.borrower_id === p.id)
      const snaps = mine.map((l) => loanSnapshot(l, l.payments, now))
      const balance = snaps.reduce((s, x) => s + x.balance, 0)
      const late = snaps.some((x) => x.state === 'overdue')
      const ps = presence.get(p.id)
      return {
        id: `b:${p.id}`,
        label: p.aka,
        hint: !p.active
          ? 'ปิดใช้งาน'
          : `${balance > 0 ? `ค้าง ${fmtBaht(balance)}${late ? ' · เลยกำหนด' : ''}` : 'ไม่มียอดค้าง'}${ps?.online ? ' · ออนไลน์อยู่' : ''}`,
        icon: <Avatar name={p.aka} avatar={p.avatar} size="sm" presence={presenceState(ps)} />,
        to: `/borrowers/${p.id}`,
        keywords: `${p.aka} ${p.username}`.toLowerCase(),
        late,
      }
    })
    const actions = ACTIONS.map((a) => ({
      ...a,
      icon: <span className="grid size-11 place-items-center rounded-full bg-pill text-xl">{ACTION_ICON[a.id]}</span>,
    }))
    return [...borrowers, ...actions]
  }, [open, people, loans, presence])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) {
      const recent = readRecent()
        .map((id) => all.find((x) => x.id === id))
        .filter((x): x is Item => !!x)
      const late = all.filter((x) => x.late && !recent.includes(x))
      return [...recent, ...late, ...all.filter((x) => x.id.startsWith('a:') && !recent.includes(x))].slice(0, 12)
    }
    const score = (x: Item) => {
      const label = x.label.toLowerCase()
      if (label.startsWith(term)) return 0
      if (label.includes(term)) return 1
      if (x.keywords.includes(term)) return 2
      return -1
    }
    return all
      .map((x) => [score(x), x] as const)
      .filter(([s]) => s >= 0)
      .sort((a, b) => a[0] - b[0])
      .map(([, x]) => x)
      .slice(0, 20)
  }, [q, all])

  if (!open) return null
  const go = (x: Item) => {
    pushRecent(x.id)
    setOpen(false)
    navigate(x.to)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/45 p-3 pt-[max(env(safe-area-inset-top),1rem)] sm:pt-[12vh]" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal
        aria-label="ค้นหาด่วน"
        className="rise-in w-full max-w-lg overflow-hidden rounded-3xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <span className="text-xl" aria-hidden>
            🔍
          </span>
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((i) => Math.min(results.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter' && results[active]) {
                go(results[active])
              } else if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
            placeholder="พิมพ์ชื่อผู้ยืม หรือคำสั่ง…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[17px] outline-none"
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `pal-${results[active].id}` : undefined}
          />
          <kbd className="hidden rounded-lg bg-pill px-2 py-1 text-xs text-muted sm:block">Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[60dvh] overflow-y-auto p-2">
          {!q && <li className="px-3 pt-1 pb-2 text-xs font-semibold text-muted">ล่าสุด · ต้องติดตาม · คำสั่งลัด</li>}
          {results.map((x, i) => (
            <li key={x.id} id={`pal-${x.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseMove={() => setActive(i)}
                onClick={() => go(x)}
                className={cx('flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left', i === active && 'bg-pill')}
              >
                {x.icon}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{x.label}</span>
                  {x.hint && <span className={cx('block truncate text-sm', x.late ? 'text-danger' : 'text-muted')}>{x.hint}</span>}
                </span>
                {i === active && <span className="hidden text-xs text-muted sm:block">↵</span>}
              </button>
            </li>
          ))}
          {!results.length && <li className="px-3 py-8 text-center text-muted">ไม่พบ “{q}”</li>}
        </ul>
      </div>
    </div>
  )
}
