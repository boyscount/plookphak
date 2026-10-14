import { describe as group, expect, it } from 'vitest'
import { describe, rainIntensity } from './weather'

group('weather codes → scene', () => {
  it('maps WMO codes to Thai labels and scene kinds', () => {
    expect(describe(0)).toMatchObject({ kind: 'clear', label: 'ท้องฟ้าแจ่มใส' })
    expect(describe(2).kind).toBe('partly')
    expect(describe(3).kind).toBe('cloudy')
    expect(describe(45).kind).toBe('fog')
    expect(describe(53).kind).toBe('drizzle')
    expect(describe(63)).toMatchObject({ kind: 'rain', label: 'ฝนตก' })
    expect(describe(81).kind).toBe('rain')
    expect(describe(95)).toMatchObject({ kind: 'storm', label: 'พายุฝนฟ้าคะนอง' })
    expect(describe(99).label).toContain('ลูกเห็บ')
  })
  it('rain strength follows the real amount with floors per kind', () => {
    expect(rainIntensity('clear', 3)).toBe(0)
    expect(rainIntensity('drizzle', 0)).toBe(0.12)
    expect(rainIntensity('rain', 0.1)).toBe(0.35)
    expect(rainIntensity('rain', 2)).toBeCloseTo(0.8)
    expect(rainIntensity('storm', 0)).toBe(0.65)
    expect(rainIntensity('storm', 10)).toBe(1)
  })
})
