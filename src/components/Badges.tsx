import { badges, TIER_LABEL, type MemberStats, type Tier } from '../lib/tier'
import { cx } from './ui'

const tierStyle: Record<Tier, string> = {
  platinum: 'bg-gradient-to-r from-[#dfe6ee] to-[#ffffff] text-[#26303b] ring-1 ring-[#aab4bf]',
  gold: 'bg-gradient-to-r from-[#e9c766] to-[#fff0b3] text-[#4a350a] ring-1 ring-[#c99a35]',
  silver: 'bg-gradient-to-r from-[#b9bec4] to-[#e2e5e8] text-[#23272c] ring-1 ring-[#8f959c]',
}

export function TierChip({ tier }: { tier: Tier }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wider', tierStyle[tier])}>
      {tier === 'platinum' ? '💎' : tier === 'gold' ? '⭐' : '🥈'} {TIER_LABEL[tier]}
    </span>
  )
}

/** แถวเหรียญรางวัล: ได้แล้วมีสี ยังไม่ได้เป็นสีเทา + คำใบ้ */
export function BadgeRow({ stats }: { stats: MemberStats }) {
  const list = badges(stats)
  const got = list.filter((b) => b.earned).length
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-bold">เหรียญรางวัล</h3>
        <span className="text-sm text-muted">
          {got}/{list.length}
        </span>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {list.map((b) => (
          <div
            key={b.id}
            title={b.hint}
            className={cx(
              'flex w-[92px] shrink-0 flex-col items-center rounded-2xl p-2.5 text-center',
              b.earned ? 'bg-surface shadow-[0_6px_16px_-10px_#7432ea]' : 'bg-pill',
            )}
          >
            <span className={cx('grid size-11 place-items-center rounded-full text-2xl', b.earned ? 'bg-gradient-to-br from-[#fff0b3] to-[#e9c766]' : 'bg-surface grayscale opacity-50')}>
              {b.icon}
            </span>
            <span className={cx('mt-1.5 text-[11px] leading-tight font-semibold', !b.earned && 'text-muted')}>{b.label}</span>
            {!b.earned && <span className="mt-0.5 text-[10px] leading-tight text-muted">🔒 {b.hint}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
