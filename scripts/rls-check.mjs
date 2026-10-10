// ตรวจสิทธิ์กับ Supabase ในเครื่อง: node scripts/rls-check.mjs (หลัง supabase db reset)
import { createClient } from '@supabase/supabase-js'
const URL = 'http://127.0.0.1:54321'
const KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
let fail = 0
const ok = (cond, msg) => { console.log(cond ? '  ok ' : 'FAIL ', msg); if (!cond) fail++ }
async function login(u) {
  const c = createClient(URL, KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email: `${u}@plookphak.local`, password: 'test1234' })
  if (error) throw new Error(`${u}: ${error.message}`)
  return c
}
const anon = createClient(URL, KEY, { auth: { persistSession: false } })
ok(((await anon.from('loans').select('*')).data ?? []).length === 0, 'anon เห็น loans 0 แถว')
ok(!!(await anon.auth.signUp({ email: 'x@y.com', password: 'abcdef12' })).error, 'สมัครเองไม่ได้')

const somchai = await login('somchai')
const nid = await login('nid')
const admin = await login('admin1')
const boss = await login('boss')

const mine = (await somchai.from('loans').select('*, payments(*)')).data
ok(mine.length === 1, 'ผู้ยืมเห็นเฉพาะ loan ตัวเอง')
ok((await somchai.from('profiles').select('*')).data.length === 1, 'ผู้ยืมเห็น profile ตัวเองเท่านั้น')
ok(!!(await somchai.from('loans').update({ principal: 1 }).eq('id', mine[0].id).select()).data?.length === false, 'ผู้ยืมแก้ loan ไม่ได้')
ok(!!(await somchai.rpc('create_account', { p_username: 'hack', p_password: 'xxxxxx', p_aka: 'h' })).error, 'ผู้ยืมสร้างบัญชีไม่ได้')

// รูปโปรไฟล์: เปลี่ยนของตัวเองได้ แต่แก้ชื่อตัวเองไม่ได้
ok(!(await somchai.rpc('set_my_avatar', { p_avatar: 'cat_finger' })).error, 'ผู้ยืมเปลี่ยนรูปโปรไฟล์ตัวเองได้')
ok((await somchai.from('profiles').select('avatar').single()).data.avatar === 'cat_finger', 'รูปโปรไฟล์ถูกบันทึก')
ok(!!(await somchai.rpc('set_my_avatar', { p_avatar: "x'; drop" })).error, 'ค่ารูปแปลก ๆ ถูกปฏิเสธ')
ok(!(await somchai.rpc('set_my_cover', { p_cover: 'noir_gold' })).error, 'ผู้ยืมเปลี่ยนธีม cover ตัวเองได้')
ok((await somchai.from('profiles').select('cover').single()).data.cover === 'noir_gold', 'ธีม cover ถูกบันทึก')
ok(!(await somchai.from('profiles').update({ aka: 'แฮก' }).eq('username', 'somchai').select()).data?.length, 'ผู้ยืมแก้ชื่อตัวเองไม่ได้')

// อัปสลิป
const nidLoan = (await nid.from('loans').select('id')).data[0].id
const upBad = await somchai.storage.from('slips').upload(`${nidLoan}/x.jpg`, new Blob(['x'], { type: 'image/jpeg' }))
ok(!!upBad.error, 'อัปสลิปเข้า loan คนอื่นไม่ได้')
const path = `${mine[0].id}/slip1.jpg`
const up = await somchai.storage.from('slips').upload(path, new Blob(['fake'], { type: 'image/jpeg' }))
ok(!up.error, 'อัปสลิปเข้า loan ตัวเองได้ ' + (up.error?.message ?? ''))
const ins = await somchai.from('payments').insert({
  loan_id: mine[0].id, amount: 999999, method: 'cash', slip_path: path, status: 'approved',
  paid_at: '2020-01-01T00:00:00Z',
}).select().single()
ok(!ins.error && ins.data.status === 'pending' && ins.data.method === 'transfer', 'ผู้ยืมบังคับสถานะ approved ไม่ได้ ' + (ins.error?.message ?? ''))
ok(ins.data && Date.parse(ins.data.paid_at) > Date.now() - 60000, 'paid_at เป็นเวลาอัปจริง ไม่ใช่ที่ส่งมา')
ok(!!(await somchai.from('payments').update({ status: 'approved' }).eq('id', ins.data.id).select()).data?.length === false, 'ผู้ยืมอนุมัติเองไม่ได้')
ok(!!(await nid.storage.from('slips').download(path)).error, 'คนอื่นเปิดสลิปไม่ได้')

// admin
const adminLoans = (await admin.from('loans').select('id')).data
ok(adminLoans.length > mine.length && adminLoans.some((l) => l.id === nidLoan), 'admin เห็นทุก loan (รวมของคนอื่น)')
ok((await admin.from('notifications').select('*')).data.some(n => n.title.includes('ส่งสลิป')), 'admin ได้แจ้งเตือนสลิปใหม่')
ok(!(await admin.storage.from('slips').download(path)).error, 'admin เปิดสลิปได้')
const appr = await admin.from('payments').update({ status: 'rejected', reject_reason: 'ยอดไม่ตรง' }).eq('id', ins.data.id).select().single()
ok(!appr.error && appr.data.reviewed_by, 'admin ปฏิเสธสลิปได้')
ok((await somchai.from('notifications').select('*')).data.some(n => n.title === 'สลิปไม่ผ่าน'), 'ผู้ยืมได้แจ้งเตือนสลิปไม่ผ่าน')
const cash = await admin.from('payments').insert({ loan_id: mine[0].id, amount: 100, method: 'cash' }).select().single()
ok(!cash.error && cash.data.status === 'approved', 'admin บันทึกเงินสด = approved ทันที')
const nb = await admin.rpc('create_account', { p_username: 'newguy', p_password: 'pass1234', p_aka: 'นิว' })
ok(!nb.error, 'admin สร้างผู้ยืมได้ ' + (nb.error?.message ?? ''))
const ng = createClient(URL, KEY, { auth: { persistSession: false } })
ok(!(await ng.auth.signInWithPassword({ email: 'newguy@plookphak.local', password: 'pass1234' })).error, 'ผู้ยืมใหม่ล็อกอินได้')
ok(!!(await admin.rpc('create_account', { p_username: 'adm2', p_password: 'pass1234', p_aka: 'a', p_role: 'admin' })).error, 'admin สร้าง admin ไม่ได้')
ok(!!(await admin.rpc('set_password', { p_user: (await boss.auth.getUser()).data.user.id, p_password: 'zzzzzz' })).error, 'admin เปลี่ยนรหัส super ไม่ได้')
ok(!!(await admin.from('audit_log').select('*')).data?.length === false, 'admin ดู audit ไม่ได้')
ok(!!(await admin.from('app_settings').update({ max_admins: 9 }).eq('id', 1).select()).data?.length === false, 'admin แก้โควตาไม่ได้')

// คำขอเลื่อน/ผ่อน + พร้อมเพย์
const newDue = new Date(Date.now() + 20 * 86400000).toISOString()
const rq = await somchai.from('loan_requests').insert({ loan_id: mine[0].id, kind: 'extend', proposed_due_at: newDue, message: 'ขอเลื่อน', status: 'approved' }).select().single()
ok(!rq.error && rq.data.status === 'pending', 'ผู้ยืมส่งคำขอได้ (บังคับ pending) ' + (rq.error?.message ?? ''))
ok(!!(await somchai.from('loan_requests').insert({ loan_id: nidLoan, kind: 'installment', installments: 3, message: 'x' })).error, 'ส่งคำขอแทนคนอื่นไม่ได้')
ok(!(await somchai.from('loan_requests').update({ status: 'approved' }).eq('id', rq.data.id).select()).data?.length, 'ผู้ยืมอนุมัติคำขอตัวเองไม่ได้')
ok(!!(await nid.from('loan_requests').select('*')).data?.every((r) => r.borrower_id !== rq.data.borrower_id), 'ผู้ยืมไม่เห็นคำขอของคนอื่น')
const ap = await admin.from('loan_requests').update({ status: 'approved', admin_note: 'ได้' }).eq('id', rq.data.id).select().single()
ok(!ap.error, 'admin อนุมัติคำขอได้ ' + (ap.error?.message ?? ''))
const moved = (await admin.from('loans').select('due_at').eq('id', mine[0].id).single()).data
ok(Math.abs(Date.parse(moved.due_at) - Date.parse(newDue)) < 1000, 'อนุมัติเลื่อนแล้ววันครบกำหนดเปลี่ยนตาม')
ok((await somchai.from('notifications').select('title')).data.some((n) => n.title.includes('อนุมัติ')), 'ผู้ยืมได้แจ้งเตือนผลคำขอ')
ok(!!(await somchai.rpc('set_promptpay', { p_id: '0812345678', p_name: 'x' })).error, 'ผู้ยืมตั้งพร้อมเพย์ไม่ได้')
ok(!(await admin.rpc('set_promptpay', { p_id: '081-234-5678', p_name: 'แอดมิน' })).error, 'admin ตั้งพร้อมเพย์ได้')
ok((await somchai.from('app_settings').select('promptpay_id').single()).data.promptpay_id === '0812345678', 'ผู้ยืมอ่านเลขพร้อมเพย์ได้ (ตัดขีดแล้ว)')

// super
const a2 = await boss.rpc('create_account', { p_username: 'adm2', p_password: 'pass1234', p_aka: 'a2', p_role: 'admin' })
ok(!a2.error, 'super สร้าง admin ได้ (โควตา 2) ' + (a2.error?.message ?? ''))
ok(!!(await boss.rpc('create_account', { p_username: 'adm3', p_password: 'pass1234', p_aka: 'a3', p_role: 'admin' })).error, 'admin เกินโควตาไม่ได้')
ok((await boss.from('audit_log').select('*')).data.length > 0, 'super ดู audit ได้')
await boss.rpc('set_account_active', { p_user: a2.data, p_active: false })
const a2c = createClient(URL, KEY, { auth: { persistSession: false } })
ok(!!(await a2c.auth.signInWithPassword({ email: 'adm2@plookphak.local', password: 'pass1234' })).error, 'admin ที่ถูกปิดล็อกอินไม่ได้')

console.log(fail ? `\n${fail} FAILED` : '\nall passed')
process.exit(fail ? 1 : 0)
