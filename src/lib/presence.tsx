// ใครออนไลน์อยู่ — heartbeat จากทุกเครื่อง + รายชื่อสำหรับ staff (ฐานข้อมูลกรองตามบทบาทให้เอง)
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from './auth'
import { supabase, SUPABASE_KEY, SUPABASE_URL } from './supabase'

export type PresenceRow = { user_id: string; last_seen_at: string; online: boolean }

const BEAT_MS = 60_000
let unsupported = false // ยังไม่ได้รัน SQL บนฐานข้อมูลจริง → หยุดส่ง ไม่ให้ error รัว

/** ส่ง "ยังอยู่" ทุกนาทีตอนเปิดหน้าจอ และ "ออกไปแล้ว" ตอนสลับแอป/ปิดแท็บ */
export function usePresenceBeat() {
  const { session, profile } = useAuth()
  const token = session?.access_token
  const active = !!token && !!profile?.active

  useEffect(() => {
    if (!active || unsupported) return
    const touch = async (away: boolean) => {
      if (unsupported) return
      const { error } = await supabase.rpc('touch_presence', { p_away: away })
      if (error && /touch_presence|PGRST202|404/.test(`${error.code} ${error.message}`)) unsupported = true
    }
    // ตอนปิดแท็บ fetch ธรรมดาอาจถูกตัด — ใช้ keepalive
    const leave = () => {
      if (unsupported) return
      fetch(`${SUPABASE_URL}/rest/v1/rpc/touch_presence`, {
        method: 'POST',
        keepalive: true,
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_away: true }),
      }).catch(() => {})
    }
    const onVisibility = () => (document.visibilityState === 'visible' ? touch(false) : leave())

    if (document.visibilityState === 'visible') touch(false)
    const timer = setInterval(() => document.visibilityState === 'visible' && touch(false), BEAT_MS)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', leave)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', leave)
    }
  }, [active, token])
}

/** staff: สถานะออนไลน์ของทุกคนที่มีสิทธิ์เห็น (อัปเดตทุก 30 วิ ตอนเปิดหน้าจอ) */
export function usePresence() {
  const { isStaff } = useAuth()
  const { data } = useQuery({
    queryKey: ['presence'],
    enabled: isStaff,
    refetchInterval: 30_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('presence_list')
      if (error) return new Map<string, PresenceRow>() // ยังไม่ได้รัน SQL ก็แค่ไม่โชว์
      return new Map((data as PresenceRow[]).map((r) => [r.user_id, r]))
    },
  })
  return data ?? new Map<string, PresenceRow>()
}

export type PresenceState = 'online' | 'recent' | null

/** online = เปิดแอปอยู่ · recent = ใช้งานภายใน 15 นาที */
export function presenceState(row: PresenceRow | undefined): PresenceState {
  if (!row) return null
  if (row.online) return 'online'
  return Date.now() - Date.parse(row.last_seen_at) < 15 * 60_000 ? 'recent' : null
}

export function presenceText(row: PresenceRow | undefined) {
  if (!row) return 'ยังไม่เคยเปิดแอป'
  if (row.online) return 'ออนไลน์อยู่'
  const min = Math.floor((Date.now() - Date.parse(row.last_seen_at)) / 60_000)
  if (min < 1) return 'ใช้งานเมื่อสักครู่'
  if (min < 60) return `ใช้งาน ${min} นาทีที่แล้ว`
  const h = Math.floor(min / 60)
  if (h < 24) return `ใช้งาน ${h} ชม.ที่แล้ว`
  const d = Math.floor(h / 24)
  return d < 30 ? `ใช้งาน ${d} วันที่แล้ว` : 'ไม่ได้ใช้งานนานแล้ว'
}
