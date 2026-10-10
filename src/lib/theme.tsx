// ธีมแอป: auto (ตามระบบ) / light / dark — เก็บเฉพาะเครื่องนี้
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemePref = 'auto' | 'light' | 'dark'
const KEY = 'plookphak:theme'

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function apply(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
  const dark = pref === 'dark' || (pref === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e0c13' : '#6d32d6')
}

function useThemeState() {
  const [pref, setPref] = useState<ThemePref>(read)
  useEffect(() => {
    apply(pref)
    try {
      if (pref === 'auto') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, pref)
    } catch {
      // private mode: ใช้ได้แค่รอบนี้
    }
    if (pref !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('auto')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])
  return [pref, setPref] as const
}

const ThemeContext = createContext<ReturnType<typeof useThemeState> | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useThemeState()
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme outside ThemeProvider')
  return ctx
}
