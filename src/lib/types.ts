export type Role = 'super_admin' | 'admin' | 'borrower'

export type Profile = {
  id: string
  username: string
  aka: string
  role: Role
  active: boolean
  avatar: string | null
  cover: string | null
  note: string | null
  created_at: string
}

export type Payment = {
  id: string
  loan_id: string
  amount: number
  method: 'transfer' | 'cash'
  slip_path: string | null
  /** ข้อความใน QR ของสลิป ใช้กันสลิปซ้ำ */
  slip_ref?: string | null
  paid_at: string
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  reject_reason: string | null
  reviewed_at: string | null
  created_at: string
}

export type Loan = {
  id: string
  borrower_id: string
  principal: number
  borrowed_on: string
  interest_start_on: string
  daily_interest: number
  due_at: string
  /** ยอดค่าปรับต่อหน่วย (ชั่วโมง หรือวัน ตาม penalty_unit) */
  hourly_penalty: number
  /** แบบพร้อมเงินต้น: hour | day (รายการเก่า/ยังไม่รัน SQL = ไม่มีค่า → hour) */
  penalty_unit?: 'hour' | 'day'
  interest_mode: 'with_principal' | 'daily'
  daily_cutoff: string
  note: string | null
  created_at: string
  borrower: Profile
  payments: Payment[]
}

export type Notification = {
  id: number
  title: string
  body: string | null
  loan_id: string | null
  read_at: string | null
  created_at: string
}

export const roleLabel: Record<Role, string> = {
  super_admin: 'Super admin',
  admin: 'ผู้ดูแลระบบ',
  borrower: 'ผู้ยืม',
}
