import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GoldCard } from '../components/GoldCard'
import { ErrorText, Field, Input, Logo, Pill } from '../components/ui'
import { errorText, supabase, usernameToEmail } from '../lib/supabase'

export function Login() {
  // เข้าสู่ระบบแล้วต้องเริ่มที่หน้าแรกเสมอ ไม่ค้างหน้าเดิมก่อนออกจากระบบ (เช่น /me)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    if (pathname !== '/') navigate('/', { replace: true })
  }, [pathname, navigate])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password })
    if (error) setError(errorText(error))
    setBusy(false)
  }

  return (
    <div className="min-h-dvh">
      <div className="pt-safe h-64 bg-gradient-to-b from-[#5a2fb8] to-[#8b4cff] px-6">
        <p className="flex items-center justify-center gap-2 pt-10 text-3xl font-bold text-white">
          <Logo className="size-11" />
          Plookphak
        </p>
        <p className="mt-1 text-center text-white/85">บันทึกยืม–คืน ไม่ต้องจดกระดาษ</p>
      </div>
      <div className="mx-auto -mt-24 max-w-sm px-4">
        {/* ชื่อบนบัตรเปลี่ยนตามที่พิมพ์ */}
        <GoldCard name={username.trim() || 'Plookphak member'} seed={username.trim().toLowerCase()} />
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field label="ชื่อผู้ใช้">
            <Input
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </Field>
          <Field label="รหัสผ่าน">
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <ErrorText error={error} />
          <Pill tone="brand" type="submit" className="w-full" disabled={busy}>
            {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
          </Pill>
          <p className="text-center text-sm text-muted">ยังไม่มีบัญชี? ขอให้ผู้ดูแลสร้างให้</p>
        </form>
      </div>
    </div>
  )
}
