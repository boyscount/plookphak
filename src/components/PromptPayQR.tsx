// QR พร้อมเพย์ใส่ยอดให้: ผู้ยืมสแกนด้วยแอปธนาคารได้ทันที
import { useEffect, useState } from 'react'
import { fmtBaht } from '../lib/format'
import { promptPayPayload } from '../lib/promptpay'
import { useSettings } from '../lib/queries'

/** ซ่อนเลขกลาง: 081-xxx-5678 */
function maskId(id: string) {
  if (id.length === 10) return `${id.slice(0, 3)}-xxx-${id.slice(6)}`
  return `${id.slice(0, 3)}xxxxxxx${id.slice(-3)}`
}

export function PromptPayQR({ amount }: { amount: number }) {
  const { data: settings } = useSettings()
  const id = settings?.promptpay_id ?? null
  const [svg, setSvg] = useState<string | null>(null)
  const [png, setPng] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !(amount > 0)) return
    let alive = true
    // โหลดตัวสร้าง QR เฉพาะตอนต้องใช้
    import('qrcode').then(async (QR) => {
      const payload = promptPayPayload(id, amount)
      const [s, p] = await Promise.all([
        QR.toString(payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0e0e10', light: '#ffffff' } }),
        QR.toDataURL(payload, { margin: 2, width: 720, errorCorrectionLevel: 'M' }),
      ])
      if (alive) {
        setSvg(s)
        setPng(p)
      }
    })
    return () => {
      alive = false
    }
  }, [id, amount])

  if (!id || !(amount > 0)) return null

  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#0b3c68] to-[#1565a8] p-4 text-white">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold tracking-wide">พร้อมเพย์ · PromptPay</span>
        <span className="tabular text-lg font-bold">{fmtBaht(amount)}</span>
      </div>
      <div className="mx-auto mt-3 w-52 rounded-2xl bg-white p-2.5">
        {svg ? (
          <div className="aspect-square [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="aspect-square animate-pulse rounded-xl bg-pill" />
        )}
      </div>
      <p className="mt-3 text-center text-sm">
        {settings?.promptpay_name ?? 'ผู้ให้ยืม'} · <span className="tabular">{maskId(id)}</span>
      </p>
      <p className="mt-1 text-center text-xs text-white/75">สแกนด้วยแอปธนาคาร ยอดถูกใส่ไว้แล้ว จ่ายเสร็จแล้วอัปสลิปด้านล่าง</p>
      {png && (
        <a
          href={png}
          download={`promptpay-${amount}.png`}
          className="mt-3 block rounded-full bg-white/15 py-2 text-center text-sm font-semibold hover:bg-white/25"
        >
          ⬇️ บันทึกรูป QR ไปสแกนในแอปธนาคาร
        </a>
      )}
    </div>
  )
}
