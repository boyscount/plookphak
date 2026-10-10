import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Loan, Notification, Profile } from './types'

const LOAN_SELECT = '*, borrower:profiles!loans_borrower_id_fkey(*), payments(*)'

async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data as T
}

/** RLS ตัดให้เอง: ผู้ยืมได้เฉพาะของตัวเอง staff ได้ทั้งหมด */
export function useLoans(borrowerId?: string) {
  return useQuery({
    queryKey: ['loans', borrowerId ?? 'all'],
    queryFn: () => {
      let q = supabase.from('loans').select(LOAN_SELECT).order('due_at', { ascending: true })
      if (borrowerId) q = q.eq('borrower_id', borrowerId)
      return must<Loan[]>(q)
    },
    refetchInterval: 60_000,
  })
}

export function useProfiles(role?: Profile['role']) {
  return useQuery({
    queryKey: ['profiles', role ?? 'all'],
    queryFn: () => {
      let q = supabase.from('profiles').select('*').order('aka')
      if (role) q = q.eq('role', role)
      return must<Profile[]>(q)
    },
  })
}

export function useProfile(id: string) {
  return useQuery({
    queryKey: ['profile', id],
    queryFn: () => must<Profile>(supabase.from('profiles').select('*').eq('id', id).single()),
  })
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      must<Notification[]>(
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
      ),
    refetchInterval: 60_000,
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      must(supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () =>
      must<{ max_admins: number; promptpay_id: string | null; promptpay_name: string | null }>(
        supabase.from('app_settings').select('*').single(),
      ),
  })
}

export type LoanRequest = {
  id: string
  loan_id: string
  borrower_id: string
  kind: 'extend' | 'installment'
  proposed_due_at: string | null
  installments: number | null
  message: string
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  decided_at: string | null
  created_at: string
}

/** คำขอเลื่อน/ผ่อน — RLS: ผู้ยืมเห็นของตัวเอง staff เห็นทั้งหมด */
export function useLoanRequests() {
  return useQuery({
    queryKey: ['requests'],
    queryFn: () =>
      must<LoanRequest[]>(supabase.from('loan_requests').select('*').order('created_at', { ascending: false }).limit(100)),
    refetchInterval: 60_000,
  })
}

/** เรียก invalidate ทุกอย่างที่เกี่ยวกับยอดเงิน */
export function useRefreshMoney() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['loans'] })
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }
}

/** เวลาปัจจุบันที่อัปเดตทุกวินาที สำหรับตัวนับ */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export async function signedSlipUrl(path: string) {
  const { data, error } = await supabase.storage.from('slips').createSignedUrl(path, 600)
  if (error) throw error
  return data.signedUrl
}

/** ย่อรูปสลิปก่อนอัป ให้ไฟล์เล็กและไม่เกินลิมิต 5MB */
export async function compressImage(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
    return blob ?? file
  } catch {
    return file
  }
}

export async function uploadSlip(loanId: string, file: File) {
  const blob = await compressImage(file)
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() ?? 'jpg')
  const path = `${loanId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('slips')
    .upload(path, blob, { contentType: blob.type || 'image/jpeg' })
  if (error) throw error
  return path
}

export { must }
