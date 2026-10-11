// แจ้งเตือนสั้น ๆ ด้านล่างจอ (พร้อมปุ่ม "เลิกทำ" ได้) — เรียก toast() จากที่ไหนก็ได้ แล้ววาง <Toaster /> ไว้ครั้งเดียว
import { useSyncExternalStore } from 'react'

type ToastItem = {
  id: number
  text: string
  tone?: 'ok' | 'danger' | 'info'
  action?: { label: string; run: () => void }
}

let items: ToastItem[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

export function toast(t: Omit<ToastItem, 'id'>, ms = 5000) {
  const id = ++seq
  items = [...items.slice(-2), { ...t, id }]
  emit()
  setTimeout(() => dismissToast(id), ms)
  return id
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

const ICON = { ok: '✓', danger: '✕', info: 'ℹ' }

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items)
  if (!list.length) return null
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4"
    >
      {list.map((t) => (
        <div
          key={t.id}
          className="rise-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-[#1b1530] py-2 pr-2 pl-4 text-sm text-white shadow-2xl"
        >
          <span
            className={
              t.tone === 'danger' ? 'text-[#ff8a8c]' : t.tone === 'ok' ? 'text-[#5ee0a8]' : 'text-[#b9a4ff]'
            }
          >
            {ICON[t.tone ?? 'info']}
          </span>
          <span className="min-w-0 flex-1 py-1.5">{t.text}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action!.run()
                dismissToast(t.id)
              }}
              className="min-h-10 shrink-0 rounded-xl px-3 font-bold text-[#c9b0ff] active:bg-white/10"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
