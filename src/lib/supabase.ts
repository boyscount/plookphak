import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  throw new Error('ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ใน .env.local ก่อน')
}

export const supabase = createClient(url, key)

/** ผู้ใช้ล็อกอินด้วย username — Supabase Auth ต้องการอีเมล จึงแปลงเป็นอีเมลภายใน */
export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@plookphak.local`

export function errorText(e: unknown): string {
  if (!e) return 'เกิดข้อผิดพลาด'
  const msg = typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (msg.includes('Invalid login credentials')) return 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
  if (msg.includes('User is banned')) return 'บัญชีนี้ถูกปิดใช้งาน'
  if (msg.includes('Failed to fetch')) return 'เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ต'
  return msg
}
