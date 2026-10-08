/**
 * Bubble Catch (§23): an answer floats down in each bubble while the timer
 * runs. Tap the bubble with the right answer — or move the buddy's net with
 * ← → and catch the one above it with Enter. Let them all fall and the time
 * is up. Untimed (beginners), the bubbles bob in the air and wait.
 *
 * A bubble grows with its words rather than cutting them: a long answer is
 * a wide, rounded pill instead of a circle. Where the sky is too narrow for
 * a column each, the bubbles fall two abreast.
 */
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { BuddyAvatar } from '@/features/buddies'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { Aside, OptionText } from '../ui/ChallengeCard'
import { useGameKeys } from './keys'
import { fitWord, optionState, type OptionState, type StyleProps } from './types'
import { useNarrow } from './useNarrow'

/** Under this many pixels a column, the bubbles fall two abreast. */
const ROOMY_COLUMN = 150
/** How far down the sky a second row of bubbles hangs, in percent. */
const ROW_GAP = 26

const BUBBLE: Record<OptionState, string> = {
  idle: 'border-surface bg-surface/90',
  right: 'border-correct bg-correct-soft',
  wrong: 'border-wrong bg-wrong-soft',
  faded: 'border-surface bg-surface/60 opacity-50',
}

/** How far the top row of bubbles has fallen, in percent of the sky: from 4
 *  to 70 as time runs, less the room the lower rows need. */
export function fallAt(timed: boolean, left: number, rows = 1): number {
  const room = 66 - (rows - 1) * ROW_GAP
  return timed ? 4 + (1 - Math.max(0, Math.min(1, left))) * room : 4 + room * 0.4
}

export function BubbleCatch(props: StyleProps) {
  const { item, outcome, locked, left, timed, calm, buddy, card, onChoose, onExpire, effect, boss } = props
  const count = item.options.length
  const [net, setNet] = useState(0)
  const [popped, setPopped] = useState<number | null>(null)
  const netRef = useRef(net)
  netRef.current = net

  useEffect(() => {
    setPopped(null)
    setNet(Math.floor((count - 1) / 2))
  }, [item.id, count])
  // Bubbles that all fall: simply out of time.
  useEffect(() => {
    onExpire(null)
  }, [onExpire])

  const catchIt = (n: number) => {
    if (locked) return
    setNet(n)
    setPopped(n)
    effect('pop')
    onChoose(n)
  }
  useGameKeys(!locked, count, {
    pick: catchIt,
    left: () => setNet((n) => Math.max(0, n - 1)),
    right: () => setNet((n) => Math.min(count - 1, n + 1)),
    go: () => catchIt(netRef.current),
  })

  const sky = useRef<HTMLDivElement>(null)
  const narrow = useNarrow(sky, count, ROOMY_COLUMN)
  const columns = narrow ? Math.min(2, count) : count
  const rows = Math.ceil(count / columns)
  const column = (n: number) => (((n % columns) + 0.5) / columns) * 100
  const y = fallAt(timed, left, rows)
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 px-3 pb-3">
      {card}
      <div ref={sky} className={cn('relative flex-1 overflow-hidden', rows > 1 ? 'min-h-[360px]' : 'min-h-[320px]')} role="group" aria-label={boss ? 'The boss challenge: catch the right bubble' : 'Catch the right bubble'}>
        {item.options.map((text, n) => {
          const state = optionState(outcome, n)
          const round = text.length <= 9 && !narrow
          const row = Math.floor(n / columns)
          return (
            <motion.button
              key={`${item.id}-${n}`}
              type="button"
              disabled={locked}
              onClick={() => catchIt(n)}
              aria-label={`Bubble ${n + 1}: ${text}`}
              className={cn(
                'absolute grid -translate-x-1/2 place-items-center border-4 px-3 py-3 text-center font-display text-lg font-bold shadow-lg [container-type:inline-size] disabled:cursor-default sm:text-xl',
                round ? 'aspect-square rounded-full' : 'min-h-20 rounded-[2.5rem]',
                BUBBLE[state],
              )}
              // A bubble never outgrows its column, so neighbours never touch.
              style={{
                left: `${column(n)}%`,
                top: `${y + row * ROW_GAP + (narrow ? 0 : (n % 2) * 6)}%`,
                width: `min(${round ? '8rem' : '15rem'}, calc(${100 / columns}% - 0.75rem))`,
              }}
              initial={calm ? false : { scale: 0, opacity: 0 }}
              animate={
                popped === n && !outcome
                  ? { scale: 1.25, opacity: 0.6 }
                  : calm || outcome
                    ? { scale: 1, opacity: 1 }
                    : { scale: 1, opacity: 1, y: [0, -8, 0] }
              }
              transition={popped === n ? spring.snappy : { y: { repeat: Infinity, duration: 2.2 + n * 0.3 }, default: { ...spring.bouncy, delay: n * 0.08 } }}
            >
              <span style={{ fontSize: fitWord(text) }} className="block w-full">
                <OptionText text={text} />
              </span>
            </motion.button>
          )
        })}
        <motion.div className="absolute bottom-1 -translate-x-1/2" initial={false} animate={{ left: `${column(net)}%` }} transition={calm ? { duration: 0 } : spring.snappy}>
          <div className="flex flex-col items-center">
            <span className="h-3 w-20 rounded-t-full border-4 border-b-0 border-primary" aria-hidden />
            <BuddyAvatar buddy={buddy} mood={outcome ? (outcome.correct ? 'cheer' : 'oops') : 'idle'} size={64} className="ring-4 ring-primary" />
          </div>
        </motion.div>
      </div>
      {!timed && !outcome && <Aside>Tap the bubble with the right answer.</Aside>}
    </div>
  )
}
