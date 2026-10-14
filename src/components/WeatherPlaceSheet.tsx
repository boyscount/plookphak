// เลือกที่อยู่สำหรับอากาศจริง: dropdown 77 จังหวัด · ค้นหาตำบล/อำเภอ · ตำแหน่งปัจจุบัน
// + ลองดูเอฟเฟกต์ฝน/พายุ (เฉพาะตอนนี้ ไม่จำไว้)
import { useState } from 'react'
import { PROVINCES } from '../lib/provinces'
import { placeFromCoords, searchPlaces, type Place, type Weather } from '../lib/weather'
import { cx, ErrorText, Field, Input, Pill, Sheet } from './ui'

export type Preview = 'live' | 'rain' | 'storm'

export function WeatherPlaceSheet({
  open,
  onClose,
  place,
  onPlace,
  weather,
  preview,
  onPreview,
}: {
  open: boolean
  onClose: () => void
  place: Place
  onPlace: (p: Place) => void
  weather: Weather | null | undefined
  preview: Preview
  onPreview: (p: Preview) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [busy, setBusy] = useState<'search' | 'gps' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pick = (p: Place) => {
    onPlace(p)
    setResults(null)
    setQ('')
    onClose()
  }

  async function search() {
    const term = q.trim()
    if (term.length < 2) return setError('พิมพ์ชื่อตำบล อำเภอ หรือสถานที่อย่างน้อย 2 ตัวอักษร')
    setBusy('search')
    setError(null)
    try {
      const r = await searchPlaces(term)
      setResults(r)
      if (!r.length) setError(`ไม่พบ “${term}” — ลองพิมพ์ชื่ออำเภอหรือจังหวัดต่อท้าย เช่น “บางพระ ศรีราชา”`)
    } catch {
      setError('ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(null)
    }
  }

  function useGps() {
    if (!navigator.geolocation) return setError('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง')
    setBusy('gps')
    setError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        pick(await placeFromCoords(pos.coords.latitude, pos.coords.longitude))
        setBusy(null)
      },
      (e) => {
        setBusy(null)
        setError(e.code === e.PERMISSION_DENIED ? 'ไม่ได้อนุญาตให้ใช้ตำแหน่ง — เลือกจังหวัดหรือค้นหาแทนได้' : 'หาตำแหน่งไม่สำเร็จ')
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 10 * 60_000 },
    )
  }

  const provinceValue = PROVINCES.find(([n, lat, lon]) => n === place.name && lat === place.lat && lon === place.lon)?.[0] ?? ''

  return (
    <Sheet open={open} onClose={onClose} title="อากาศจริงในฉาก">
      <div className="space-y-4">
        <div className="card-depth rounded-2xl px-4 py-3">
          <p className="text-sm text-muted">📍 {place.detail ? `${place.name} · ${place.detail}` : place.name}</p>
          {weather ? (
            <p className="mt-0.5 text-lg font-bold">
              {weather.icon} {weather.label} · {weather.temp}°C
              <span className="ml-2 text-sm font-medium text-muted">ลม {Math.round(weather.wind)} กม./ชม.</span>
            </p>
          ) : (
            <p className="mt-0.5 text-muted">กำลังโหลดอากาศ…</p>
          )}
        </div>

        <Pill tone="brand" className="w-full" disabled={busy === 'gps'} onClick={useGps}>
          {busy === 'gps' ? 'กำลังหาตำแหน่ง…' : '📍 ใช้ตำแหน่งปัจจุบัน'}
        </Pill>

        <Field label="ค้นหาตำบล / อำเภอ / สถานที่">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              search()
            }}
          >
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="เช่น บางพระ ศรีราชา, ลาดพร้าว" enterKeyHint="search" />
            <button type="submit" disabled={busy === 'search'} className="shrink-0 rounded-2xl bg-pill px-4 font-semibold">
              {busy === 'search' ? '…' : 'ค้นหา'}
            </button>
          </form>
        </Field>
        <ErrorText error={error} />
        {results && results.length > 0 && (
          <ul className="card-depth divide-y divide-line overflow-hidden rounded-2xl">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon},${r.name}`}>
                <button type="button" onClick={() => pick(r)} className="w-full px-4 py-3 text-left active:bg-pill">
                  <span className="block font-semibold">{r.name}</span>
                  {r.detail && <span className="block text-sm text-muted">{r.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        <Field label="หรือเลือกจังหวัด">
          <select
            className="h-12 w-full rounded-2xl bg-pill px-4"
            value={provinceValue}
            onChange={(e) => {
              const p = PROVINCES.find(([n]) => n === e.target.value)
              if (p) pick({ name: p[0], lat: p[1], lon: p[2] })
            }}
          >
            <option value="" disabled>
              — เลือกจังหวัด —
            </option>
            {PROVINCES.map(([n]) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink/80">ลองดูเอฟเฟกต์</span>
          <div className="grid grid-cols-3 gap-1 rounded-full bg-pill p-1" role="radiogroup" aria-label="ลองดูเอฟเฟกต์">
            {(
              [
                ['live', '🌤️ อากาศจริง'],
                ['rain', '🌧️ ฝนตก'],
                ['storm', '⛈️ พายุ'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={preview === id}
                onClick={() => onPreview(id)}
                className={cx('min-h-10 rounded-full text-sm font-semibold', preview === id ? 'bg-surface text-brand-700 shadow' : 'text-muted')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted">
          ข้อมูลอากาศ Open-Meteo (อัปเดตทุก 15 นาที) · ค้นหาสถานที่ © OpenStreetMap contributors · ที่อยู่ที่เลือกจำไว้ในเครื่องนี้เท่านั้น
        </p>
      </div>
    </Sheet>
  )
}
