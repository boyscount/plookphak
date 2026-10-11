import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {}, SUPABASE_URL: '', SUPABASE_KEY: '' }))
vi.mock('./auth', () => ({ useAuth: () => ({}) }))
const { presenceState, presenceText } = await import('./presence')

const now = Date.parse('2026-10-15T10:00:00Z')
const ago = (min: number) => new Date(now - min * 60_000).toISOString()

describe('presence labels', () => {
  afterEach(() => vi.useRealTimers())
  it('maps rows to dot state and Thai text', () => {
    vi.useFakeTimers({ now })
    expect(presenceState(undefined)).toBe(null)
    expect(presenceState({ user_id: 'a', last_seen_at: ago(0), online: true })).toBe('online')
    expect(presenceState({ user_id: 'a', last_seen_at: ago(5), online: false })).toBe('recent')
    expect(presenceState({ user_id: 'a', last_seen_at: ago(60), online: false })).toBe(null)
    expect(presenceText({ user_id: 'a', last_seen_at: ago(0), online: true })).toBe('ออนไลน์อยู่')
    expect(presenceText({ user_id: 'a', last_seen_at: ago(5), online: false })).toBe('ใช้งาน 5 นาทีที่แล้ว')
    expect(presenceText({ user_id: 'a', last_seen_at: ago(180), online: false })).toBe('ใช้งาน 3 ชม.ที่แล้ว')
    expect(presenceText({ user_id: 'a', last_seen_at: ago(2 * 1440), online: false })).toBe('ใช้งาน 2 วันที่แล้ว')
    expect(presenceText(undefined)).toBe('ยังไม่เคยเปิดแอป')
  })
})
