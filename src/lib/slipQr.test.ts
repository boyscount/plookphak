import { describe, expect, it } from 'vitest'
import { classifySlipQr } from './slipQr'

describe('classifySlipQr', () => {
  it('no QR', () => expect(classifySlipQr(null)).toEqual({ kind: 'none' }))
  it('PromptPay receive QR is not a slip', () =>
    expect(classifySlipQr('00020101021129370016A000000677010111011300669123456785802TH53037646304ABCD').kind).toBe('promptpay'))
  it('bank slip mini QR keeps its reference', () =>
    expect(classifySlipQr(' 004100060000010103014022520261014ABC123XYZ5102TH91049C2F ')).toEqual({
      kind: 'slip',
      ref: '004100060000010103014022520261014ABC123XYZ5102TH91049C2F',
    }))
})
