// ตรวจสิทธิ์ระบบออนไลน์กับฐานข้อมูลในเครื่อง: node --experimental-websocket scripts/presence-check.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.trim().split(/=(.*)/s).slice(0, 2)),
)
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

async function login(username) {
  const c = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signInWithPassword({ email: `${username}@plookphak.local`, password: 'test1234' })
  if (error) throw error
  return { c, id: data.user.id }
}

const boss = await login('boss')
const admin = await login('admin1')
const borrower = await login('somchai')
for (const u of [boss, admin, borrower]) await u.c.rpc('touch_presence', { p_away: false })

const ids = (rows) => new Set((rows ?? []).map((r) => r.user_id))
const { data: bossSees } = await boss.c.rpc('presence_list')
const { data: adminSees } = await admin.c.rpc('presence_list')
const { data: borrowerSees } = await borrower.c.rpc('presence_list')

check('super admin เห็น admin, ผู้ยืม และตัวเอง', ids(bossSees).has(admin.id) && ids(bossSees).has(borrower.id) && ids(bossSees).has(boss.id))
check('admin เห็นผู้ยืม', ids(adminSees).has(borrower.id))
check('admin ไม่เห็น super admin', !ids(adminSees).has(boss.id))
check('ผู้ยืมไม่เห็นใครเลย', (borrowerSees ?? []).length === 0, `${(borrowerSees ?? []).length} แถว`)
check('ผู้ยืมที่เพิ่ง heartbeat = online', bossSees.find((r) => r.user_id === borrower.id)?.online === true)

await borrower.c.rpc('touch_presence', { p_away: true })
const { data: after } = await boss.c.rpc('presence_list')
check('สลับแอปออก → ไม่ online แต่ยังมีเวลาใช้งานล่าสุด', after.find((r) => r.user_id === borrower.id)?.online === false)

const direct = await borrower.c.from('presence').select('*')
check('อ่านตาราง presence ตรง ๆ ไม่ได้', !!direct.error || (direct.data ?? []).length === 0, direct.error?.message ?? '')
const anon = createClient(url, key, { auth: { persistSession: false } })
const anonRes = await anon.rpc('presence_list')
check('คนที่ไม่ได้ล็อกอินเรียกไม่ได้', !!anonRes.error, anonRes.error?.message ?? '')

process.exit(failed ? 1 : 0)
