// สำรอง/ส่งออกข้อมูลทั้งหมด (staff): Excel อ่านง่าย + JSON ข้อมูลดิบไว้กู้คืน
// ทำในเบราว์เซอร์ทั้งหมด ไม่ส่งข้อมูลไปเซิร์ฟเวอร์อื่น
import type { CellObject, Sheet } from 'write-excel-file/browser'
import { fmtDateTime } from './format'
import { dailyPlan, loanSnapshot } from './loanMath'
import { must } from './queries'
import { supabase } from './supabase'
import { memberStats, TIER_LABEL, tierOf } from './tier'
import type { Loan, Profile } from './types'

const STATE_TH = {
  not_due: 'ยังไม่ครบกำหนด',
  grace: 'ครบกำหนดแล้ว',
  overdue: 'เลยกำหนด',
  pending_review: 'รอตรวจสลิป',
  paid: 'จ่ายครบ',
} as const

async function fetchAll(includeAudit: boolean) {
  const [profiles, loans, requests, settings, audit] = await Promise.all([
    must<Profile[]>(supabase.from('profiles').select('*').order('aka')),
    must<Loan[]>(supabase.from('loans').select('*, borrower:profiles!loans_borrower_id_fkey(*), payments(*)').order('created_at')),
    must<Record<string, unknown>[]>(supabase.from('loan_requests').select('*').order('created_at')).catch(() => []),
    must<Record<string, unknown>>(supabase.from('app_settings').select('*').single()),
    includeAudit
      ? must<Record<string, unknown>[]>(supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(5000))
      : Promise.resolve([]),
  ])
  return { profiles, loans, requests, settings, audit }
}

function stamp() {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 16).replace(/[-:T]/g, '')
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** JSON ข้อมูลดิบครบทุกช่อง (ไม่รวมรูปสลิป) */
export async function exportJson(includeAudit: boolean) {
  const data = await fetchAll(includeAudit)
  const payload = { app: 'plookphak', version: 1, exported_at: new Date().toISOString(), ...data }
  download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `plookphak-backup-${stamp()}.json`)
  return { loans: data.loans.length, payments: data.loans.reduce((n, l) => n + l.payments.length, 0) }
}

type Cell = CellObject
const head = (labels: string[]): Cell[] => labels.map((value) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#5f24c7', color: '#ffffff' }))
const money = (n: number) => Math.round(n * 100) / 100

/** Excel หลายชีต สำหรับเปิดดู/พิมพ์/เก็บเป็นหลักฐาน */
export async function exportExcel(includeAudit: boolean) {
  const { profiles, loans, requests, audit } = await fetchAll(includeAudit)
  const now = Date.now()
  const name = (id: string) => profiles.find((p) => p.id === id)?.aka ?? id

  const snaps = loans.map((l) => ({ l, s: loanSnapshot(l, l.payments, now) }))

  const borrowers = profiles.filter((p) => p.role === 'borrower')
  const summary = [
    head(['AKA', 'ชื่อผู้ใช้', 'สถานะบัญชี', 'ระดับบัตร', 'จำนวนรายการ', 'จ่ายแล้วรวม', 'ยอดค้างรวม']),
    ...borrowers.map((p) => {
      const mine = snaps.filter((x) => x.l.borrower_id === p.id)
      return [
        { value: p.aka },
        { value: p.username },
        { value: p.active ? 'ใช้งาน' : 'ปิดใช้งาน' },
        { value: TIER_LABEL[tierOf(memberStats(mine.map((x) => x.l), now))] },
        { value: mine.length },
        { value: money(mine.reduce((n, x) => n + x.s.approved, 0)) },
        { value: money(mine.reduce((n, x) => n + x.s.balance, 0)) },
      ]
    }),
  ]

  const loanRows = [
    head([
      'ผู้ยืม', 'รูปแบบดอก', 'เงินต้น', 'วันที่ยืม', 'วันเริ่มคิดดอก', 'ดอก/วัน', 'ตัดรอบ', 'วันครบกำหนด', 'ค่าปรับ/ชม.',
      'วันคิดดอก', 'ดอกสะสม', 'ค่าปรับสะสม', 'ยอดรวม', 'จ่ายแล้ว (อนุมัติ)', 'รอตรวจ', 'คงเหลือ', 'จ่ายดอกถึงวันที่', 'สถานะ', 'หมายเหตุ',
    ]),
    ...snaps.map(({ l, s }) => [
      { value: l.borrower?.aka ?? name(l.borrower_id) },
      { value: l.interest_mode === 'daily' ? 'รายวัน' : 'พร้อมเงินต้น' },
      { value: Number(l.principal) },
      { value: l.borrowed_on },
      { value: l.interest_start_on },
      { value: Number(l.daily_interest) },
      { value: l.interest_mode === 'daily' ? (l.daily_cutoff ?? '').slice(0, 5) : '' },
      { value: fmtDateTime(l.due_at) },
      { value: Number(l.hourly_penalty) },
      { value: s.days },
      { value: s.interest },
      { value: s.penalty },
      { value: s.total },
      { value: s.approved },
      { value: s.pending },
      { value: s.balance },
      { value: l.interest_mode === 'daily' ? (dailyPlan(l, l.payments, now).paidThrough ?? '-') : '' },
      { value: STATE_TH[s.state] },
      { value: l.note ?? '' },
    ]),
  ]

  const STATUS = { pending: 'รอตรวจ', approved: 'อนุมัติ', rejected: 'ไม่ผ่าน' } as const
  const paymentRows = [
    head(['ผู้ยืม', 'เวลาที่จ่าย', 'ยอด', 'วิธี', 'สถานะ', 'หมายเหตุ', 'เหตุผลไม่ผ่าน', 'ตรวจเมื่อ', 'มีสลิป']),
    ...loans
      .flatMap((l) => l.payments.map((p) => ({ l, p })))
      .sort((a, b) => Date.parse(a.p.paid_at) - Date.parse(b.p.paid_at))
      .map(({ l, p }) => [
        { value: l.borrower?.aka ?? name(l.borrower_id) },
        { value: fmtDateTime(p.paid_at) },
        { value: Number(p.amount) },
        { value: p.method === 'cash' ? 'เงินสด' : 'โอน' },
        { value: STATUS[p.status] },
        { value: p.note ?? '' },
        { value: p.reject_reason ?? '' },
        { value: p.reviewed_at ? fmtDateTime(p.reviewed_at) : '' },
        { value: p.slip_path ? 'มี' : '' },
      ]),
  ]

  const requestRows = [
    head(['ผู้ยืม', 'ประเภท', 'รายละเอียด', 'เหตุผล', 'สถานะ', 'หมายเหตุผู้ดูแล', 'ส่งเมื่อ']),
    ...requests.map((r) => [
      { value: name(String(r.borrower_id)) },
      { value: r.kind === 'extend' ? 'เลื่อนวัน' : 'ขอผ่อน' },
      { value: r.kind === 'extend' ? fmtDateTime(String(r.proposed_due_at)) : `${r.installments} งวด` },
      { value: String(r.message ?? '') },
      { value: r.status === 'approved' ? 'อนุมัติ' : r.status === 'rejected' ? 'ไม่อนุมัติ' : 'รอพิจารณา' },
      { value: String(r.admin_note ?? '') },
      { value: fmtDateTime(String(r.created_at)) },
    ]),
  ]

  const sheets: Sheet<Blob>[] = [
    { sheet: 'สรุปผู้ยืม', data: summary, columns: [22, 16, 12, 12, 12, 14, 14].map((width) => ({ width })) },
    { sheet: 'รายการยืม', data: loanRows, columns: [18, 13, 11, 12, 13, 9, 8, 18, 10, 9, 11, 11, 12, 15, 10, 12, 15, 16, 24].map((width) => ({ width })) },
    { sheet: 'การชำระ', data: paymentRows, columns: [18, 18, 11, 8, 9, 30, 20, 18, 8].map((width) => ({ width })) },
    { sheet: 'คำขอ', data: requestRows, columns: [18, 11, 22, 30, 12, 24, 18].map((width) => ({ width })) },
  ]
  if (includeAudit) {
    sheets.push({
      sheet: 'บันทึกระบบ',
      data: [
        head(['เวลา', 'ผู้ทำ', 'การกระทำ', 'ตาราง', 'รหัสแถว']),
        ...audit.map((a) => [
          { value: fmtDateTime(String(a.at)) },
          { value: a.actor ? name(String(a.actor)) : 'ระบบ' },
          { value: String(a.action) },
          { value: String(a.table_name) },
          { value: String(a.row_id ?? '') },
        ]),
      ],
      columns: [18, 18, 10, 14, 38].map((width) => ({ width })),
    })
  }

  // โหลดตัวเขียน Excel เฉพาะตอนกด
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const blob = await writeXlsxFile(sheets.map((s) => ({ ...s, stickyRowsCount: 1 }))).toBlob()
  download(blob, `plookphak-${stamp()}.xlsx`)
  return { loans: loans.length, payments: paymentRows.length - 1 }
}
