/**
 * What Mentora says around a game (§25, §26), read aloud: the story's opening,
 * each island's **Learn it** — the story beat that makes the idea matter, then
 * the idea with its picture and what to do — what an island taught with its
 * stars and the story moving on, and the ending. The story is told as
 * speech-bubble panels.
 */
import { motion } from 'motion/react'
import { ArrowRight, Confetti, HandPointing, SpeakerHigh, Sparkle, Star, Stop } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { BuddyAvatar } from '@/features/buddies'
import type { StoryLine } from '@/features/learning/api'
import { cn } from '@/lib/utils'
import { spring, useCalmMotion } from '@/motion'
import { AcceptMission } from './mission/Accept'
import { Said } from './mission/narration'

export interface Telling {
  reading: boolean
  readable: boolean
  toggle: () => void
}

/** Who is speaking in the story: the player's buddy, or its main character. */
export interface Cast {
  buddyKey: string | null | undefined
  buddyName: string
  character: string
}

/** A line of the story with the player's own buddy named. */
export const told = (text: string | undefined, buddy: string) => (text ?? '').split('{buddy}').join(buddy)

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

/** The story as a comic: each line a speech bubble beside who says it. */
export function Panels({ lines, cast }: { lines: StoryLine[]; cast: Cast }) {
  const calm = useCalmMotion()
  if (!lines.length) return null
  return (
    <ol className="space-y-3" aria-label="The story">
      {lines.map((line, n) => {
        const buddy = line.who === '{buddy}' || line.who === cast.buddyName
        const who = buddy ? cast.buddyName : told(line.who, cast.buddyName) || cast.character
        return (
          <motion.li
            key={n}
            initial={calm ? false : { opacity: 0, x: buddy ? 16 : -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring.gentle, delay: calm ? 0 : n * 0.35 }}
            className={cn('flex items-end gap-2', buddy && 'flex-row-reverse')}
          >
            {buddy ? (
              <BuddyAvatar buddy={cast.buddyKey} size={48} className="shrink-0" />
            ) : (
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-sun-400 bg-sun-100 font-display text-lg font-bold text-grape-900 dark:bg-sun-600/40 dark:text-sun-100">
                {initials(who)}
              </span>
            )}
            <div className={cn('min-w-0 rounded-2xl border-2 px-3 py-2', buddy ? 'rounded-br-sm border-primary/30 bg-selected' : 'rounded-bl-sm border-border bg-muted/60')}>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{who}</p>
              <p className="break-words text-lg"><Said text={told(line.says, cast.buddyName)} /></p>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]?.toUpperCase()).join('') || '★'
}

export function Stars({ count, of = 3, label }: { count: number; of?: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={label ?? `${count} of ${of} stars`}>
      {Array.from({ length: of }, (_, n) => (
        <Star key={n} weight={n < count ? 'fill' : 'regular'} className={cn('size-7', n < count ? 'text-warning' : 'text-border')} aria-hidden />
      ))}
    </span>
  )
}

export function StoryCard({ title, hook, goal, lines, cast, count, telling, onStart }: {
  title: string; hook: string; goal: string; lines: StoryLine[]; cast: Cast; count: number; telling: Telling; onStart: () => void
}) {  // fmt: skip
  return (
    <Card label="The story">
      <p className="text-sm font-bold uppercase tracking-wide text-primary">{count} islands to explore</p>
      <h2 className="mt-1 break-words font-display text-3xl font-semibold">{title}</h2>
      {hook && <p className="mt-3 break-words text-lg italic text-muted-foreground"><Said text={hook} /></p>}
      <div className="mt-4">
        <Panels lines={lines} cast={cast} />
      </div>
      {goal && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-star-soft px-3 py-2 font-semibold">
          <Star weight="fill" className="mt-1 size-4 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 break-words">
            <span className="font-bold">Your mission: </span>
            <Said text={goal} />
          </span>
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <ReadAloud telling={telling} />
        <AcceptMission onStart={onStart} />
      </div>
    </Card>
  )
}

/** Learn it: the beat that makes the idea matter, then the idea, big, with
 *  its picture — and what the round will ask. */
export function LearnCard({ number, total, icon, learn, task, play, lines, cast, telling, howTo, onTry }: {
  number: number; total: number; icon: string; learn: string; task: string; play: string; lines: StoryLine[]; cast: Cast; telling: Telling; howTo?: React.ReactNode; onTry: () => void
}) {  // fmt: skip
  return (
    <Card label="Learn it">
      <p className="text-sm font-bold uppercase tracking-wide text-primary">
        Island {number} of {total} · {play}
      </p>
      {lines.length > 0 && (
        <div className="mt-3">
          <Panels lines={lines} cast={cast} />
        </div>
      )}
      <div className="mt-4 flex items-center gap-4 rounded-3xl bg-sky-100 p-4 dark:bg-sky-700/30">
        {icon && <span className="shrink-0 text-6xl leading-none" aria-hidden>{icon}</span>}
        <p className="min-w-0 break-words font-display text-2xl font-semibold leading-snug"><Said text={told(learn, cast.buddyName)} /></p>
      </div>
      {task && (
        <p className="mt-3 flex items-start gap-2 text-lg font-semibold">
          <HandPointing weight="fill" className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 break-words"><Said text={told(task, cast.buddyName)} /></span>
        </p>
      )}
      {howTo && <div className="mt-3">{howTo}</div>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <ReadAloud telling={telling} />
        <Button variant="sun" size="lg" onClick={onTry} autoFocus>
          Let's play!
          <ArrowRight weight="bold" className="size-5" />
        </Button>
      </div>
    </Card>
  )
}

export function Discovery({ number, learn, reached, stars, explanation, lines, cast, last, telling, onNext }: {
  number: number; learn: string; reached: boolean; stars: number; explanation: string; lines: StoryLine[]; cast: Cast; last: boolean; telling: Telling; onNext: () => void
}) {  // fmt: skip
  return (
    <Card label="What you discovered" className={reached ? 'border-correct' : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-2xl font-bold">
          {reached && <Sparkle weight="fill" className="size-7 text-warning" aria-hidden />}
          {reached ? `Island ${number} cleared!` : `Island ${number}`}
        </p>
        {reached && <Stars count={stars} />}
      </div>
      <p className="mt-1 break-words text-muted-foreground">{learn}</p>
      {explanation && (
        <div className="mt-4 rounded-2xl bg-correct-soft px-4 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-success">What you discovered</p>
          <p className="mt-1 break-words text-lg"><Said text={told(explanation, cast.buddyName)} /></p>
        </div>
      )}
      {lines.length > 0 && (
        <div className="mt-4">
          <Panels lines={lines} cast={cast} />
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <ReadAloud telling={telling} label="Read why" />
        <Button variant="sun" size="lg" onClick={onNext} autoFocus>
          {last ? 'To the finish' : 'Back to the map'}
          <ArrowRight weight="bold" className="size-5" />
        </Button>
      </div>
    </Card>
  )
}

export function Finale({ win, lines, cast, reached, total, stars, points, telling, onDone, doneLabel }: {
  win: string; lines: StoryLine[]; cast: Cast; reached: number; total: number; stars: number; points: number; telling: Telling; onDone: () => void; doneLabel: string
}) {  // fmt: skip
  return (
    <Card label="The end of the game">
      <div className="text-center">
        <Confetti weight="duotone" className="mx-auto size-12 text-primary" aria-hidden />
        <h2 className="mt-2 font-display text-3xl font-semibold">{reached === total ? 'Every island cleared!' : 'Well played!'}</h2>
        {win && <p className="mt-2 break-words text-lg"><Said text={win} /></p>}
      </div>
      {lines.length > 0 && (
        <div className="mt-4">
          <Panels lines={lines} cast={cast} />
        </div>
      )}
      <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-display text-xl font-semibold">
        <Stars count={stars} of={total * 3} label={`${stars} of ${total * 3} stars`} />
        <span>
          {reached} of {total} islands · <span className="tabular-nums">{points}</span> points
        </span>
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
