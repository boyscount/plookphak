import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Profile } from './types'

type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isStaff: boolean
  isSuper: boolean
  reloadProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  // ผู้ใช้ที่โหลดโปรไฟล์ไว้แล้ว — supabase ส่ง SIGNED_IN ซ้ำทุกครั้งที่กลับมาที่แท็บ
  // ถ้าเป็นคนเดิม ให้โหลดเงียบ ๆ ไม่แสดงหน้าโหลดทับ (หน้าต่างที่เปิดอยู่จะได้ไม่หาย)
  const loadedFor = useRef<string | null>(null)

  async function loadProfile(s: Session | null) {
    if (!s) {
      loadedFor.current = null
      setProfile(null)
      return
    }
    const quiet = loadedFor.current === s.user.id
    if (!quiet) setProfileLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
    loadedFor.current = s.user.id
    setProfile(data as Profile | null)
    setProfileLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // ห้าม await ใน callback ของ supabase-js — เลื่อนออกไปก่อน
        if (s && loadedFor.current !== s.user.id) setProfileLoading(true)
        setTimeout(() => loadProfile(s), 0)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const role = profile?.active ? profile.role : null
  const value: AuthState = {
    session,
    profile,
    loading: loading || profileLoading,
    isStaff: role === 'admin' || role === 'super_admin',
    isSuper: role === 'super_admin',
    reloadProfile: () => loadProfile(session),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
