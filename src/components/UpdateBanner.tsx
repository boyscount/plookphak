// แถบ "มีเวอร์ชันใหม่" — เช็ค /version.json ทุก 5 นาที และทุกครั้งที่กลับมาเปิดแอป
// และลงทะเบียน service worker (เปิดเร็วขึ้น + ใช้ออฟไลน์ได้)
import { useEffect, useState } from 'react'

const CHECK_EVERY = 5 * 60_000

async function latestBuild(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return ((await res.json()) as { id?: string }).id ?? null
  } catch {
    return null
  }
}

export function UpdateBanner() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) return
    navigator.serviceWorker?.register('/sw.js').catch(() => {})

    let last = 0
    const check = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 30_000) return
      last = Date.now()
      const id = await latestBuild()
      if (id && id !== __BUILD_ID__) setReady(true)
    }
    // ไฟล์ chunk รุ่นเก่าหายหลัง deploy → โหลดหน้าใหม่ให้เอง (ครั้งเดียว กันวนลูป)
    const onChunkError = (e: Event) => {
      e.preventDefault()
      if (sessionStorage.getItem('plookphak:reloaded') === __BUILD_ID__) return setReady(true)
      sessionStorage.setItem('plookphak:reloaded', __BUILD_ID__)
      location.reload()
    }
    const timer = setInterval(check, CHECK_EVERY)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('vite:preloadError', onChunkError)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('vite:preloadError', onChunkError)
    }
  }, [])

  if (!ready) return null
  return (
    <div className="rise-in fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full bg-brand-900 py-2 pr-2 pl-4 text-sm text-white shadow-2xl">
        <span>✨ มีเวอร์ชันใหม่</span>
        <button
          type="button"
          onClick={() => location.reload()}
          className="min-h-9 rounded-full bg-white px-4 font-semibold text-brand-900 active:scale-95"
        >
          อัปเดตเลย
        </button>
        <button type="button" onClick={() => setReady(false)} className="grid size-9 place-items-center rounded-full text-white/70" aria-label="ไว้ทีหลัง">
          ✕
        </button>
      </div>
    </div>
  )
}
