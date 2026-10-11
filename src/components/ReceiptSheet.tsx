// ดูใบเสร็จเป็นรูป แล้วแชร์ (มือถือ: LINE ฯลฯ) หรือบันทึกลงเครื่อง
import { useEffect, useMemo, useState } from 'react'
import { drawReceipt, receiptData } from '../lib/receipt'
import type { Loan, Payment } from '../lib/types'
import { toast } from './Toast'
import { Pill, Sheet } from './ui'

export function ReceiptSheet({ loan, payment, onClose }: { loan: Loan; payment: Payment; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  useEffect(() => {
    let alive = true
    drawReceipt(receiptData(loan, payment)).then(
      (b) => alive && setBlob(b),
      () => toast({ text: 'สร้างใบเสร็จไม่สำเร็จ', tone: 'danger' }),
    )
    return () => {
      alive = false
    }
  }, [loan, payment])

  const fileName = `plookphak-receipt-${payment.id.slice(0, 8)}.png`
  const file = blob ? new File([blob], fileName, { type: 'image/png' }) : null
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  function save() {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
  }

  async function share() {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: 'ใบเสร็จ Plookphak' })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') save()
    }
  }

  return (
    <Sheet open onClose={onClose} title="ใบเสร็จ">
      <div className="space-y-4">
        {url ? (
          <img src={url} alt="ใบเสร็จรับเงิน" className="mx-auto max-h-[60dvh] rounded-2xl shadow-lg" />
        ) : (
          <div className="skel mx-auto aspect-[3/4] max-h-[60dvh] rounded-2xl" />
        )}
        <div className={canShare ? 'grid grid-cols-2 gap-2' : ''}>
          {canShare && (
            <Pill tone="brand" disabled={!file} onClick={share}>
              แชร์
            </Pill>
          )}
          <Pill tone={canShare ? 'gray' : 'brand'} className="w-full" disabled={!url} onClick={save}>
            บันทึกรูป
          </Pill>
        </div>
      </div>
    </Sheet>
  )
}
