// service worker แบบเรียบง่าย
// - หน้าเว็บ (HTML): ดึงจากเน็ตก่อนเสมอ ออฟไลน์ค่อยใช้ของที่เก็บไว้ → deploy ใหม่เห็นทันทีที่รีเฟรช
// - ไฟล์ใน /assets (มี hash ในชื่อ ไม่เปลี่ยนเนื้อหา): ใช้ของในเครื่องก่อน เปิดเร็ว และไม่พังตอนไฟล์รุ่นเก่าถูกลบหลัง deploy
// - อย่างอื่น (Supabase, ฟอนต์) ปล่อยผ่านตามปกติ
const PAGES = 'pages-v1'
const ASSETS = 'assets-v1'
const MAX_ASSETS = 120

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== PAGES && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function trim() {
  const cache = await caches.open(ASSETS)
  const keys = await cache.keys()
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(k)
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(PAGES).then((c) => c.put('/', copy))
          }
          return res
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    )
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(ASSETS).then((c) => c.put(req, copy).then(trim))
            }
            return res
          }),
      ),
    )
  }
})
