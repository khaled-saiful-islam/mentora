/**
 * Lane Runner (§23): the buddy runs down a road with a lane for each option;
 * an answer gate stands at the end of every lane and comes rushing up as the
 * timer runs. Switch lanes with ← → (or tap a lane) and run through the gate
 * with the right answer. When the gates arrive, the lane the buddy is in is
 * the answer. Untimed (beginners), the gates wait and "Go!" runs through.
 */
import { motion } from 'motion/react'
import { ArrowFatUp } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { BuddyAvatar } from '@/features/buddies'
import { cn } from '@/lib/utils'
import { spring, wobble } from '@/motion'
import { Aside, OptionText } from '../ui/ChallengeCard'
import { useGameKeys } from './keys'
import { OptionTile } from './OptionTile'
import { fitWord, optionState, type OptionState, type StyleProps } from './types'
import { useNarrow } from './useNarrow'

/** Under this many pixels a lane, the gates carry numbers and the words are
 *  listed above the road. */
const ROOMY_LANE = 200
/** How far apart the gates stand at the horizon (1 is a full lane each). */
const FAR_SPREAD = 0.6

const GATE: Record<OptionState, string> = {
  idle: 'border-surface bg-surface',
  right: 'border-correct bg-correct-soft',
  wrong: 'border-wrong bg-wrong-soft',
  faded: 'border-surface bg-surface opacity-50',
}

/** Where a gate is on the way up the road, 0 (far) → 1 (at the runner). */
export function gateProgress(timed: boolean, left: number): number {
  return timed ? Math.min(1, Math.max(0, 1 - left)) : 0.55
}

export function LaneRunner(props: StyleProps) {
  const { item, outcome, locked, left, timed, calm, buddy, card, onChoose, onExpire, effect, boss } = props
  const lanes = item.options.length
  const [lane, setLane] = useState(Math.floor((lanes - 1) / 2))
  const laneRef = useRef(lane)
  laneRef.current = lane
  const road = useRef<HTMLDivElement>(null)

  // A new challenge: back to the middle of the road.
  useEffect(() => setLane(Math.floor((lanes - 1) / 2)), [item.id, lanes])
  // When the gates arrive, the lane you are in is your answer.
  useEffect(() => {
    onExpire(() => onChoose(laneRef.current))
    return () => onExpire(null)
  }, [onExpire, onChoose])

  const move = (to: number) => {
    if (locked) return
    const next = Math.max(0, Math.min(lanes - 1, to))
    if (next !== laneRef.current) effect('whoosh')
    setLane(next)
  }
  useGameKeys(!locked, lanes, {
    pick: (n) => (move(n), onChoose(n)),
    left: () => move(laneRef.current - 1),
    right: () => move(laneRef.current + 1),
    go: () => onChoose(laneRef.current),
  })

  const t = outcome ? 1 : gateProgress(timed, left)
  const narrow = useNarrow(road, lanes, ROOMY_LANE)
  const centre = (i: number) => ((i + 0.5) / lanes) * 100
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 px-3 pb-3">
      {card}
      {narrow && (
        // On a narrow road the gates carry numbers; the words are here, large.
        <ol className="grid gap-2" aria-label="The lanes">
          {item.options.map((text, n) => (
            <li key={n}>
              <OptionTile n={n} text={text} state={optionState(outcome, n)} disabled={locked} calm={calm} onChoose={() => (move(n), onChoose(n))} className="min-h-12 py-2 text-base" />
            </li>
          ))}
        </ol>
      )}
      <div ref={road} className="relative min-h-[240px] flex-1 sm:min-h-[300px] overflow-hidden rounded-3xl" style={{ perspective: '900px' }} role="group" aria-label={boss ? 'The boss challenge: pick your lane' : 'Pick your lane'}>
        {/* The road, narrowing towards the horizon. */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
          <polygon points={`${50 - FAR_SPREAD * 50},0 ${50 + FAR_SPREAD * 50},0 100,100 0,100`} fill="hsl(var(--surface) / 0.35)" />
          {Array.from({ length: lanes - 1 }, (_, i) => {
            const at = ((i + 1) / lanes) * 100
            return <line key={i} x1={50 - FAR_SPREAD * 50 + at * FAR_SPREAD} y1="0" x2={at} y2="100" stroke="hsl(var(--surface) / 0.9)" strokeWidth="0.6" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          })}
        </svg>
        {item.options.map((text, n) => {
          const state = optionState(outcome, n)
          // Far gates gather towards the horizon — less so on a narrow screen,
          // where every gate needs its whole lane. A gate never outgrows its
          // lane, so neighbours never overlap.
          const far = narrow ? 0.88 : FAR_SPREAD
          const spread = far + (1 - far) * t
          const x = 50 + (centre(n) - 50) * spread
          const lane = (100 / lanes) * spread
          const width = `min(16rem, calc(${lane}% - 8px))`
          return (
            <motion.button
              key={n}
              type="button"
              disabled={locked}
              onClick={() => (move(n), onChoose(n))}
              aria-label={`Lane ${n + 1}: ${text}`}
              className={cn(
                'absolute flex -translate-x-1/2 items-center justify-center rounded-t-[2rem] border-4 border-b-0 px-2 pt-3 pb-2 text-center font-display font-bold shadow-lg [container-type:inline-size] disabled:cursor-default',
                GATE[state],
                lane === n && !outcome && 'ring-4 ring-primary',
              )}
              style={{ left: `${x}%`, top: `${6 + t * 48}%`, width, fontSize: `${narrow ? 0.85 + 0.15 * t : 1.05 + 0.3 * t}rem` }}
              animate={state === 'wrong' && !calm ? wobble : undefined}
            >
              {narrow ? (
                <span className="text-3xl leading-none">{n + 1}</span>
              ) : (
                <span style={{ fontSize: fitWord(text) }} className="block w-full">
                  <OptionText text={text} />
                </span>
              )}
            </motion.button>
          )
        })}
        <motion.div
          className="absolute bottom-2 -translate-x-1/2"
          initial={false}
          animate={{ left: `${centre(lane)}%` }}
          transition={calm ? { duration: 0 } : spring.snappy}
        >
          <motion.div animate={calm || outcome ? {} : { y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 0.42 }}>
            <BuddyAvatar buddy={buddy} mood={outcome ? (outcome.correct ? 'cheer' : 'oops') : 'idle'} size={72} className="ring-4 ring-primary" />
          </motion.div>
        </motion.div>
      </div>
      {!timed && !outcome && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Aside>Pick a lane with ← → or a tap, then run!</Aside>
          <Button variant="sun" size="lg" disabled={locked} onClick={() => onChoose(laneRef.current)}>
            <ArrowFatUp weight="fill" className="size-5" />
            Go!
          </Button>
        </div>
      )}
    </div>
  )
}
