const baht = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export const fmtBaht = (n: number) => `${baht.format(n)} ฿`

const dateFmt = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'short',
  year: '2-digit',
})
const dateTimeFmt = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'short',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** 'YYYY-MM-DD' หรือ ISO */
export const fmtDate = (v: string) => dateFmt.format(new Date(v.length === 10 ? `${v}T00:00:00+07:00` : v))
export const fmtDateTime = (v: string | number) => dateTimeFmt.format(new Date(v))

const pad = (n: number) => String(n).padStart(2, '0')

/** แสดงระยะเวลาเป็น วัน ชม:นาที:วินาที */
export function fmtDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return { d, h, m, s, text: `${d > 0 ? `${d} วัน ` : ''}${pad(h)}:${pad(m)}:${pad(s)}` }
}

export function timeAgo(v: string) {
  const sec = Math.floor((Date.now() - Date.parse(v)) / 1000)
  if (sec < 60) return 'เมื่อสักครู่'
  if (sec < 3600) return `${Math.floor(sec / 60)} นาทีที่แล้ว`
  if (sec < 86400) return `${Math.floor(sec / 3600)} ชั่วโมงที่แล้ว`
  return fmtDateTime(v)
}

/** ค่าเริ่มต้นสำหรับ <input type="date"> ตามเวลาไทย */
export function todayBkk() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}

/** ISO → ค่าของ <input type="datetime-local"> ตามเวลาไทย */
export function toLocalInput(iso: string) {
  return new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 16)
}

/** ค่าจาก <input type="datetime-local"> (ตีความเป็นเวลาไทย) → ISO */
export function fromLocalInput(v: string) {
  return new Date(`${v}:00+07:00`).toISOString()
}
