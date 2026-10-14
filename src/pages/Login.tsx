import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GoldCard } from '../components/GoldCard'
import { LoginScene } from '../components/LoginScene'
import { ErrorText, Field, Input, Logo, Pill } from '../components/ui'
import { WeatherPlaceSheet, type Preview } from '../components/WeatherPlaceSheet'
import { usePlace, useWeather, type Weather } from '../lib/weather'
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
  // อากาศจริงของที่อยู่ที่เลือก ขับฉากฝน/ฟ้าแลบ
  const [place, setPlace] = usePlace()
  const { data: live } = useWeather(place)
  const [placeOpen, setPlaceOpen] = useState(false)
  const [preview, setPreview] = useState<Preview>('live')
  const weather: Weather | null = live
    ? preview === 'rain'
      ? { ...live, kind: 'rain', label: 'ฝนตก (ตัวอย่าง)', icon: '🌧️', rain: 0.55, lightning: false, cloud: 0.9 }
      : preview === 'storm'
        ? { ...live, kind: 'storm', label: 'พายุฝนฟ้าคะนอง (ตัวอย่าง)', icon: '⛈️', rain: 0.85, lightning: true, cloud: 1, wind: Math.max(live.wind, 25) }
        : live
    : null

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
      <LoginScene weather={weather} demo={preview === 'storm'}>
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
        {/* อากาศตอนนี้ + เปลี่ยนที่อยู่ */}
        <button
          type="button"
          onClick={() => setPlaceOpen(true)}
          className="card-depth mx-auto mt-5 flex max-w-full items-center gap-2 rounded-full py-1.5 pr-2 pl-4 text-sm"
        >
          <span className="truncate">
            📍 <b>{place.name}</b>
            {weather && (
              <>
                {' · '}
                {weather.icon} {weather.label} {weather.temp}°
              </>
            )}
          </span>
          <span className="shrink-0 rounded-full bg-pill px-2.5 py-1 text-xs font-semibold">เปลี่ยน</span>
        </button>
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
      <WeatherPlaceSheet
        open={placeOpen}
        onClose={() => setPlaceOpen(false)}
        place={place}
        onPlace={setPlace}
        weather={weather}
        preview={preview}
        onPreview={setPreview}
      />
    </div>
  )
}
