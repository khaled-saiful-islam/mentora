/**
 * What Mentora says over a game (§24.3), in its own words and controls: the
 * story's opening before the first mission, what a mission taught once it is
 * reached — the checked explanation, never the game's own words — and the
 * ending. Each can be read aloud.
 */
import { motion } from 'motion/react'
import { ArrowRight, Confetti, Play, SpeakerHigh, Sparkle, Star, Stop } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'

export interface Telling {
  reading: boolean
  readable: boolean
  toggle: () => void
}

function ReadAloud({ telling, label = 'Read it to me' }: { telling: Telling; label?: string }) {
  if (!telling.readable) return null
  return (
    <Button variant="ghost" size="sm" onClick={telling.toggle} aria-pressed={telling.reading}>
      {telling.reading ? <Stop weight="fill" className="size-4" /> : <SpeakerHigh weight="bold" className="size-4" />}
      {telling.reading ? 'Stop' : label}
    </Button>
  )
}

function Card({ children, className, label }: { children: React.ReactNode; className?: string; label: string }) {
  return (
    <motion.section
      role="dialog"
      aria-label={label}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.gentle}
      className={cn('w-full max-w-xl rounded-3xl border-4 border-surface bg-surface p-5 shadow-lg sm:p-6', className)}
    >
      {children}
    </motion.section>
  )
}

export function StoryCard({ title, hook, goal, count, telling, onStart }: { title: string; hook: string; goal: string; count: number; telling: Telling; onStart: () => void }) {
  return (
    <Card label="The story">
      <p className="text-sm font-bold uppercase tracking-wide text-primary">{count} missions</p>
      <h2 className="mt-1 break-words font-display text-3xl font-semibold">{title}</h2>
      {hook.split('\n\n').map((part, n) => (
        <p key={n} className="mt-3 break-words text-lg">{part}</p>
      ))}
      {goal && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-star-soft px-3 py-2 font-semibold">
          <Star weight="fill" className="mt-1 size-4 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 break-words">{goal}</span>
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <ReadAloud telling={telling} />
        <Button variant="sun" size="lg" onClick={onStart} autoFocus>
          <Play weight="fill" className="size-5" />
          Let's play
        </Button>
      </div>
    </Card>
  )
}

export function Discovery({ number, goal, reached, explanation, last, telling, onNext }: {
  number: number; goal: string; reached: boolean; explanation: string; last: boolean; telling: Telling; onNext: () => void
}) {  // fmt: skip
  return (
    <Card label="What you discovered" className={reached ? 'border-correct' : undefined}>
      <p className="flex items-center gap-2 font-display text-2xl font-bold">
        {reached ? <Sparkle weight="fill" className="size-7 text-warning" /> : null}
        {reached ? `Mission ${number} done!` : `Mission ${number}`}
      </p>
      <p className="mt-1 break-words text-muted-foreground">{goal}</p>
      {explanation && (
        <div className="mt-4 rounded-2xl bg-correct-soft px-4 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-success">What you discovered</p>
          <p className="mt-1 break-words text-lg">{explanation}</p>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <ReadAloud telling={telling} label="Read why" />
        <Button variant="sun" size="lg" onClick={onNext} autoFocus>
          {last ? 'To the finish' : 'Keep going'}
          <ArrowRight weight="bold" className="size-5" />
        </Button>
      </div>
    </Card>
  )
}

export function Finale({ win, reached, total, points, telling, onDone, doneLabel }: {
  win: string; reached: number; total: number; points: number; telling: Telling; onDone: () => void; doneLabel: string
}) {  // fmt: skip
  return (
    <Card label="The end of the game" className="text-center">
      <Confetti weight="duotone" className="mx-auto size-12 text-primary" aria-hidden />
      <h2 className="mt-2 font-display text-3xl font-semibold">{reached === total ? 'Every mission done!' : 'Well played!'}</h2>
      {win && <p className="mt-3 break-words text-lg">{win}</p>}
      <p className="mt-4 font-display text-xl font-semibold">
        {reached} of {total} missions · <span className="tabular-nums">{points}</span> points
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <ReadAloud telling={telling} />
        <Button variant="sun" size="lg" onClick={onDone} autoFocus>
          {doneLabel}
          <ArrowRight weight="bold" className="size-5" />
        </Button>
      </div>
    </Card>
  )
}
