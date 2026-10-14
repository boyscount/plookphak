// อากาศจริงสำหรับฉากหน้า login: Open-Meteo (ฟรี ไม่ต้องใช้ key) + ค้นหาสถานที่ด้วย OpenStreetMap Nominatim
// ส่งออกไปแค่พิกัดที่ปัดเศษแล้ว (~1 กม.) ไม่มีข้อมูลบัญชีผู้ใช้
import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

export type Place = { name: string; detail?: string; lat: number; lon: number }

const PLACE_KEY = 'plookphak:weather-place'
export const DEFAULT_PLACE: Place = { name: 'กรุงเทพมหานคร', lat: 13.752, lon: 100.494 }

function readPlace(): Place {
  try {
    const p = JSON.parse(localStorage.getItem(PLACE_KEY) ?? 'null')
    if (p && typeof p.lat === 'number' && typeof p.lon === 'number' && typeof p.name === 'string') return p
  } catch {
    /* ไม่มี storage ก็ใช้ค่าเริ่มต้น */
  }
  return DEFAULT_PLACE
}

/** ที่อยู่ที่เลือกไว้ (จำไว้ในเครื่องนี้) */
export function usePlace() {
  const [place, setPlaceState] = useState<Place>(readPlace)
  const setPlace = useCallback((p: Place) => {
    const clean = { ...p, lat: round(p.lat, 3), lon: round(p.lon, 3) }
    setPlaceState(clean)
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify(clean))
    } catch {
      /* เก็บไม่ได้ก็ใช้ได้แค่รอบนี้ */
    }
  }, [])
  return [place, setPlace] as const
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'storm'

export type Weather = {
  code: number
  kind: WeatherKind
  label: string
  icon: string
  temp: number
  /** มม. ใน 15 นาทีล่าสุด แปลงเป็นความแรงฝน 0..1 */
  rain: number
  cloud: number // 0..1
  wind: number // กม./ชม.
  isDay: boolean
  lightning: boolean
  time: string
}

/** แปลงรหัสอากาศ WMO เป็นประเภทฉาก + ข้อความไทย */
export function describe(code: number): { kind: WeatherKind; label: string; icon: string } {
  if (code >= 95) return { kind: 'storm', label: code >= 96 ? 'พายุฝนฟ้าคะนอง มีลูกเห็บ' : 'พายุฝนฟ้าคะนอง', icon: '⛈️' }
  if (code >= 80) return { kind: 'rain', label: code === 82 ? 'ฝนตกหนัก' : 'ฝนตกเป็นช่วง ๆ', icon: '🌧️' }
  if (code >= 61 && code <= 67) return { kind: 'rain', label: code >= 65 ? 'ฝนตกหนัก' : code >= 63 ? 'ฝนตก' : 'ฝนตกเล็กน้อย', icon: '🌧️' }
  if (code >= 51 && code <= 57) return { kind: 'drizzle', label: 'ฝนปรอย', icon: '🌦️' }
  if (code === 45 || code === 48) return { kind: 'fog', label: 'มีหมอก', icon: '🌫️' }
  if (code === 3) return { kind: 'cloudy', label: 'เมฆมาก', icon: '☁️' }
  if (code === 1 || code === 2) return { kind: 'partly', label: 'มีเมฆบางส่วน', icon: '⛅' }
  if (code >= 71 && code <= 86) return { kind: 'rain', label: 'หิมะ/ลูกเห็บ', icon: '🌨️' }
  return { kind: 'clear', label: 'ท้องฟ้าแจ่มใส', icon: '☀️' }
}

/** ความแรงฝนที่ใช้วาด: ฝนปรอยเบา ๆ, ฝนตกตามปริมาณจริง, พายุแรงเสมอ */
export function rainIntensity(kind: WeatherKind, mm: number) {
  const byAmount = Math.min(1, mm / 2.5) // 2.5 มม./15 นาที ≈ ฝนหนักมาก
  if (kind === 'storm') return Math.max(0.65, byAmount)
  if (kind === 'rain') return Math.max(0.35, byAmount)
  if (kind === 'drizzle') return Math.max(0.12, Math.min(0.3, byAmount))
  return 0
}

export async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const url =
    'https://api.open-meteo.com/v1/forecast?' +
    new URLSearchParams({
      latitude: String(round(lat, 2)),
      longitude: String(round(lon, 2)),
      current: 'temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,is_day',
      timezone: 'Asia/Bangkok',
    })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`weather ${res.status}`)
  const c = (await res.json()).current
  const d = describe(c.weather_code)
  return {
    code: c.weather_code,
    ...d,
    temp: Math.round(c.temperature_2m),
    rain: rainIntensity(d.kind, Number(c.precipitation) || 0),
    cloud: Math.max(0, Math.min(1, (c.cloud_cover ?? 0) / 100)),
    wind: Number(c.wind_speed_10m) || 0,
    isDay: c.is_day === 1,
    lightning: d.kind === 'storm',
    time: c.time,
  }
}

/** อากาศ ณ ตอนนี้ของที่อยู่ที่เลือก — รีเฟรชทุก 15 นาที (Open-Meteo อัปเดตทุก 15 นาที) */
export function useWeather(place: Place) {
  return useQuery({
    queryKey: ['weather', round(place.lat, 2), round(place.lon, 2)],
    queryFn: () => fetchWeather(place.lat, place.lon),
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 1,
  })
}

export type Preview = 'live' | 'rain' | 'storm'

/** ลองดูเอฟเฟกต์: แทนอากาศจริงด้วยฝน/พายุตัวอย่าง (ไม่จำไว้) */
export function applyPreview(live: Weather | undefined, preview: Preview): Weather | null {
  if (!live) return null
  if (preview === 'rain') return { ...live, kind: 'rain', label: 'ฝนตก (ตัวอย่าง)', icon: '🌧️', rain: 0.55, lightning: false, cloud: 0.9 }
  if (preview === 'storm')
    return { ...live, kind: 'storm', label: 'พายุฝนฟ้าคะนอง (ตัวอย่าง)', icon: '⛈️', rain: 0.85, lightning: true, cloud: 1, wind: Math.max(live.wind, 25) }
  return live
}

// ---------------------------------------------------------------------------
// ค้นหาสถานที่ (ไทย ระดับตำบล/อำเภอ) — Nominatim: ห้ามยิงทุกตัวอักษร จึงค้นเมื่อกดค้นหาเท่านั้น
// ---------------------------------------------------------------------------

type NominatimRow = {
  lat: string
  lon: string
  name: string
  addresstype?: string
  address?: Record<string, string>
}

const SKIP_TYPES = new Set(['railway', 'road', 'highway', 'building', 'amenity', 'shop', 'basin', 'water', 'house'])

function toPlace(r: NominatimRow): Place {
  const a = r.address ?? {}
  const district = a.county || a.city_district || (a.city !== r.name ? a.city : undefined)
  const province = a.state || a.province || (a.city?.includes('กรุงเทพ') ? 'กรุงเทพมหานคร' : undefined)
  const detail = [district, province].filter((x) => x && x !== r.name).join(' · ')
  return { name: r.name, detail: detail || undefined, lat: Number(r.lat), lon: Number(r.lon) }
}

let lastSearch = 0

export async function searchPlaces(q: string): Promise<Place[]> {
  // นโยบาย Nominatim: ไม่เกิน 1 ครั้ง/วินาที
  const wait = lastSearch + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastSearch = Date.now()
  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({ q, format: 'jsonv2', countrycodes: 'th', 'accept-language': 'th', limit: '10', addressdetails: '1' })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`search ${res.status}`)
  const rows = (await res.json()) as NominatimRow[]
  const seen = new Set<string>()
  return rows
    .filter((r) => !SKIP_TYPES.has(r.addresstype ?? ''))
    .map(toPlace)
    .filter((p) => {
      const k = `${p.name}|${p.detail}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, 8)
}

/** ชื่อตำบล/อำเภอจากพิกัด (ใช้กับปุ่มตำแหน่งปัจจุบัน) */
export async function placeFromCoords(lat: number, lon: number): Promise<Place> {
  const url =
    'https://nominatim.openstreetmap.org/reverse?' +
    new URLSearchParams({ lat: String(round(lat, 3)), lon: String(round(lon, 3)), format: 'jsonv2', zoom: '14', 'accept-language': 'th' })
  try {
    const res = await fetch(url)
    const r = (await res.json()) as NominatimRow & { address?: Record<string, string> }
    const a = r.address ?? {}
    const name = a.suburb || a.town || a.village || a.quarter || a.city_district || a.county || a.city || r.name || 'ตำแหน่งปัจจุบัน'
    const detail = [a.county || a.city_district, a.state || a.province || a.city].filter((x) => x && x !== name).join(' · ')
    return { name, detail: detail || undefined, lat, lon }
  } catch {
    return { name: 'ตำแหน่งปัจจุบัน', lat, lon }
  }
}
