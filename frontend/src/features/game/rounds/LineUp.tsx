/**
 * Line Up (§26): the steps of a process, events in time or the words of a
 * sentence, shuffled; the child taps the one that comes next. A right one
 * locks into its numbered place; one that comes later wobbles and the buddy
 * says why, so the order is learnt one step at a time.
 */
import { AnimatePresence, motion } from 'motion/react'
import { Check } from '@phosphor-icons/react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { ReadIt, SHOW_ME_MS, SIZE, useFinish, useLater, useShowMe, useWobble } from './parts'
import { outOfOrder, shuffled, type Shuffled } from './shuffle'
import type { Band, OrderContent, RoundProps, Step } from './types'

export function LineUp({ content, band, calm, say, sound, showMe, onMove, onDone, shuffle = shuffled }: RoundProps<OrderContent> & Shuffled) {
  const steps = content.steps
  const [pool] = useState(() => outOfOrder(steps, shuffle))
  // How many are in place: always the first ones, in order.
  const [count, setCount] = useState(0)
  const [showing, setShowing] = useState<string | null>(null)
  const [scope, shake] = useWobble(calm)
  const later = useLater()
  const next = steps[count] ?? null
  const inPlace = new Set(steps.slice(0, count).map((step) => step.id))
  useFinish(steps.length > 0 && count >= steps.length, onDone)

  function pick(step: Step) {
    if (!next || showing) return
    const right = step.id === next.id
    onMove({ piece: step.id, right })
    if (right) {
      sound('correct')
      setCount((n) => n + 1)
      return
    }
    sound('wrong')
    say(step.why)
    shake(step.id)
  }

  useShowMe(showMe, () => {
    if (!next || showing) return
    setShowing(next.id)
    later(() => {
      setCount((n) => n + 1)
      setShowing(null)
      sound('correct')
    }, SHOW_ME_MS)
  })

  const where = count === 0 ? 'first' : 'next'
  return (
    <div ref={scope} className="h-full min-h-0 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
        <ol aria-label="The line" className="space-y-2">
          {steps.map((step, n) => (
            <Slot key={step.id} number={n + 1} step={n < count ? step : null} waiting={n === count} band={band} calm={calm} />
          ))}
        </ol>
        <div className="min-w-0">
          <p className="mb-3 w-fit max-w-full break-words rounded-full bg-surface/90 px-4 py-1 font-display text-lg font-bold" aria-live="polite">
            {next ? `What comes ${where}?` : 'All in order!'}
          </p>
          <ul aria-label="Steps to place" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <AnimatePresence>
              {pool
                .filter((step) => !inPlace.has(step.id))
                .map((step) => (
                  <motion.li
                    key={step.id}
                    layout={!calm}
                    exit={calm ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.6 }}
                    transition={spring.snappy}
                    className="flex min-w-0 items-center gap-1"
                  >
                    <button
                      type="button"
                      data-piece={step.id}
                      onClick={() => pick(step)}
                      aria-label={`Put '${step.text}' ${where}`}
                      className={cn(
                        'flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border-2 bg-surface px-4 py-3 text-left font-semibold shadow-sm transition-colors',
                        'hover:border-hover-border hover:bg-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
                        SIZE[band].piece,
                        showing === step.id ? 'border-primary bg-selected ring-4 ring-primary/40' : 'border-border',
                      )}
                    >
                      {step.icon && <span className={cn(SIZE[band].icon, 'shrink-0 leading-none')} aria-hidden>{step.icon}</span>}
                      <span className="min-w-0 break-words">{step.text}</span>
                    </button>
                    {band === 'early' && <ReadIt text={step.text} say={say} />}
                  </motion.li>
                ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </div>
  )
}

/** A numbered place in the line: empty, the one to fill now, or locked. */
function Slot({ number, step, waiting, band, calm }: { number: number; step: Step | null; waiting: boolean; band: Band; calm: boolean }) {
  if (!step) {
    return (
      <li
        className={cn(
          'flex min-h-14 items-center gap-3 rounded-2xl border-2 border-dashed px-3 py-2',
          waiting ? 'border-primary bg-selected' : 'border-border bg-surface/70',
        )}
      >
        <Badge n={number} />
        <span className="font-semibold text-muted-foreground">{waiting ? 'Next…' : ''}</span>
      </li>
    )
  }
  return (
    <motion.li
      initial={calm ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring.bouncy}
      aria-label={`Step ${number}: ${step.text}`}
      className={cn('flex min-h-14 items-center gap-3 rounded-2xl border-2 border-correct bg-correct-soft px-3 py-2 font-semibold', SIZE[band].piece)}
    >
      <Badge n={number} done />
      {step.icon && <span className={cn(SIZE[band].icon, 'shrink-0 leading-none')} aria-hidden>{step.icon}</span>}
      <span className="min-w-0 flex-1 break-words">{step.text}</span>
      <Check weight="bold" className="size-5 shrink-0 text-success" aria-hidden />
    </motion.li>
  )
}

function Badge({ n, done = false }: { n: number; done?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full font-display text-base font-bold',
        done ? 'bg-correct text-white' : 'border-2 border-border text-muted-foreground',
      )}
    >
      {n}
    </span>
  )
}
