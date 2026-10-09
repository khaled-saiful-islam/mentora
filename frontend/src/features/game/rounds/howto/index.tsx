/**
 * How to play a template (§26.8): the animated demo and its three steps,
 * lit in turn as the demo plays them, and Read it to me in the browser's
 * voice (these are the app's own words, not the game's). Calm: the demo holds
 * still at its last step, and every step is lit.
 *
 * Open on a template's first island in a game; folded away after, and on
 * asking from the game bar.
 */
import { motion } from 'motion/react'
import { CaretDown, Question, SpeakerHigh, Stop } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { useReadAloud } from '@/features/guide/useReadAloud'
import { cn } from '@/lib/utils'
import type { Play } from '../types'
import { Demo, type Phase } from './demos'
import { HOW_TO, languageOf, STUCK, TITLE } from './steps'

export { HOW_TO } from './steps'

// Each step of the demo stays on screen this long.
export const STEP_MS = 1600

/** The demo's step, going round — or held at the last one when calm. */
export function usePhase(calm: boolean): Phase {
  const [phase, setPhase] = useState<Phase>(calm ? 2 : 0)
  useEffect(() => {
    if (calm) {
      setPhase(2)
      return
    }
    const timer = window.setInterval(() => setPhase((at) => ((at + 1) % 3) as Phase), STEP_MS)
    return () => window.clearInterval(timer)
  }, [calm])
  return phase
}

interface HowToProps {
  play: Play
  /** The game's language: `ms` for Malay, anything else English. */
  language: string
  calm: boolean
}

export function HowToPlay({ play, language, calm }: HowToProps) {
  const words = languageOf(language)
  const steps = HOW_TO[play][words]
  const phase = usePhase(calm)
  const voice = useReadAloud(language)
  const key = `how-${play}`
  const reading = voice.reading === key
  return (
    <section aria-label={TITLE[words]} className="rounded-3xl border-2 border-border bg-surface p-3">
      <Demo play={play} phase={phase} />
      <ol className="mt-3 space-y-1.5">
        {steps.map((step, n) => (
          <motion.li
            key={step}
            initial={false}
            animate={{ opacity: calm || n === phase ? 1 : 0.55 }}
            className={cn('flex items-start gap-2 rounded-xl px-2 py-1', !calm && n === phase && 'bg-selected')}
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">{n + 1}</span>
            <span className="min-w-0 break-words font-semibold">{step}</span>
          </motion.li>
        ))}
      </ol>
      <p className="mt-2 break-words px-2 text-sm text-muted-foreground">{STUCK[words]}</p>
      {voice.supported && (
        <Button variant="ghost" size="sm" className="mt-1" aria-pressed={reading} onClick={() => (reading ? voice.stop() : voice.read(key, [...steps, STUCK[words]].join(' ')))}>
          {reading ? <Stop weight="fill" className="size-4" /> : <SpeakerHigh weight="bold" className="size-4" />}
          {reading ? 'Stop' : 'Read how to play'}
        </Button>
      )}
    </section>
  )
}

/** Folded away, to open on asking: a template met before in this game. */
export function HowToFolded(props: HowToProps) {
  const [open, setOpen] = useState(false)
  const words = languageOf(props.language)
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen((was) => !was)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-primary hover:bg-primary/10">
        <Question weight="bold" className="size-4" />
        {TITLE[words]}
        <CaretDown weight="bold" className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-2">
          <HowToPlay {...props} />
        </div>
      )}
    </div>
  )
}
