import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GoldCard } from '../components/GoldCard'
import { LoginScene } from '../components/LoginScene'
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
      <LoginScene>
        {/* ป้ายชื่อแบบกระจกฝ้า อ่านได้ทั้งฉากกลางวันและกลางคืน */}
        <div className="mx-auto mt-4 w-fit rounded-3xl bg-white/25 px-5 py-2 text-center shadow-lg ring-1 ring-white/40 backdrop-blur-md">
          <p className="flex items-center justify-center gap-2 text-3xl font-bold text-white [text-shadow:0_2px_8px_rgb(0_0_0/.35)]">
            <Logo className="size-10" />
            Plookphak
          </p>
          <p className="text-sm text-white [text-shadow:0_1px_6px_rgb(0_0_0/.45)]">บันทึกยืม–คืน ไม่ต้องจดกระดาษ</p>
        </div>
      </LoginScene>
      <div className="relative z-10 mx-auto -mt-24 max-w-sm px-4">
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
