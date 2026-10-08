/**
 * Quest Map (§23): the chapter is a winding path across the world, one stop
 * per challenge. The buddy stands at the stop being played and walks on to
 * the next; a stop answered right turns to a star, the last stop of the game
 * is the boss's crown. Best for the youngest — nothing moves until they
 * choose, unless the game is timed.
 */
import { motion } from 'motion/react'
import { Crown, Star } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { BuddyAvatar } from '@/features/buddies'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { useGameKeys } from './keys'
import { OptionTile } from './OptionTile'
import { COLUMNS, optionState, type StyleProps } from './types'

/** Where stop `i` of `n` sits on the path, in percent of the strip. */
export function stopAt(i: number, n: number): { x: number; y: number } {
  const x = n <= 1 ? 50 : 8 + (84 * i) / (n - 1)
  return { x, y: 50 + 30 * Math.sin(0.6 + (i / Math.max(n - 1, 1)) * Math.PI * 1.6) }
}

export function QuestMap(props: StyleProps) {
  const { item, index, items, chapterStart, chapterItems, played, boss, outcome, locked, calm, buddy, card, onChoose, onExpire, effect } = props
  const here = index - chapterStart
  const stops = chapterItems.map((_, i) => stopAt(i, chapterItems.length))
  const path = curveThrough(stops.map((s) => [s.x * 10, s.y]))
  useEffect(() => {
    onExpire(null)
  }, [onExpire])
  useEffect(() => {
    if (here > 0) effect('step')
  }, [here, effect])
  useGameKeys(!locked, item.options.length, { pick: onChoose })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-3 px-3 pb-3">
      <div className="relative h-28 w-full shrink-0 sm:h-36" role="img" aria-label={`Stop ${here + 1} of ${chapterItems.length} on the map`}>
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
          <path d={path} fill="none" stroke="hsl(var(--surface) / 0.85)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={path} fill="none" stroke="hsl(var(--star))" strokeWidth="4" strokeDasharray="2 14" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {chapterItems.map((challenge, i) => {
          const result = played[challenge.id]
          const isBoss = chapterStart + i === items.length - 1 && items.length > 2
          return (
            <span
              key={challenge.id}
              className={cn(
                'absolute grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 shadow sm:size-12',
                result?.correct ? 'border-star bg-star' : result ? 'border-surface bg-muted' : i === here ? 'border-primary bg-surface' : 'border-surface bg-surface/80',
              )}
              style={{ left: `${stops[i].x}%`, top: `${stops[i].y}%` }}
            >
              {isBoss ? <Crown weight="fill" className="size-5 text-warning" /> : result?.correct ? <Star weight="fill" className="size-5 text-surface" /> : <span className="font-display text-sm font-bold">{i + 1}</span>}
            </span>
          )
        })}
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-[85%]"
          initial={false}
          animate={{ left: `${stops[here].x}%`, top: `${stops[here].y}%` }}
          transition={calm ? { duration: 0 } : spring.gentle}
        >
          <motion.div animate={calm || locked ? {} : { y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}>
            <BuddyAvatar buddy={buddy} mood={outcome ? (outcome.correct ? 'happy' : 'oops') : 'idle'} size={56} className="ring-4 ring-primary" />
          </motion.div>
        </motion.div>
      </div>
      {card}
      <div className={cn('grid gap-3', item.options.length > 2 && 'sm:grid-cols-2', COLUMNS[item.options.length])} role="group" aria-label={boss ? 'The boss challenge: choose your answer' : 'Choose your answer'}>
        {item.options.map((text, n) => (
          <OptionTile key={n} n={n} text={text} state={optionState(outcome, n)} disabled={locked} calm={calm} onChoose={() => onChoose(n)} />
        ))}
      </div>
    </div>
  )
}

/** A smooth curve through the stops: each leg an easy S from one to the next. */
export function curveThrough(points: [number, number][]): string {
  if (!points.length) return ''
  return points.reduce((d, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`
    const [px, py] = points[i - 1]
    const mid = (px + x) / 2
    return `${d} C ${mid} ${py} ${mid} ${y} ${x} ${y}`
  }, '')
}
