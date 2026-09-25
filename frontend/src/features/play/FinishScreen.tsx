/**
 * The moment at the end: a score that counts up, stars that land one by
 * one, new badges, a place on the board, and a buddy who is thrilled
 * whatever happened. Kind to a low score; it never says "fail".
 */
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { ArrowClockwise, ClipboardText, House, Ranking, Star } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Button, ButtonLink } from '@/components/ui'
import { BadgeMedal } from '@/features/badges/medals'
import { Buddy, BuddyStage, type BuddyHandle, type Cue } from '@/features/buddies'
import { useAuth } from '@/lib/auth'
import { useSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { celebrate, pop, spring, stagger, useCalmMotion } from '@/motion'
import type { Finish } from './api'
import { verdictFor, type Verdict } from './session'

const HEADLINE: Record<Verdict, string[]> = {
  great: ['Amazing!', 'Superstar!', 'Brilliant!'],
  good: ['Great job!', 'Nicely done!', 'Well played!'],
  keep: ['Good try!', 'Keep going!', 'You did it!'],
}

const CUE: Record<Verdict, Cue> = { great: 'finishGreat', good: 'finishGood', keep: 'finishKeep' }

export function FinishScreen({
  finish,
  onReview,
  onRetake,
  leaderboardTo,
}: {
  finish: Finish
  onReview: () => void
  onRetake: (() => void) | null
  leaderboardTo: string | null
}) {
  const { user } = useAuth()
  const calm = useCalmMotion()
  const sound = useSound()
  const buddy = useRef<BuddyHandle>(null)
  const { attempt, stars } = finish
  const verdict = verdictFor(stars)
  const [headline] = useState(() => HEADLINE[verdict][Math.floor(Math.random() * 3)])
  const flashcards = attempt.kind === 'flashcard'
  const guide = attempt.kind === 'study_guide'

  useEffect(() => {
    sound('finish')
    const cue = window.setTimeout(() => buddy.current?.cue(CUE[verdict]), 500)
    if (stars >= 2) window.setTimeout(() => celebrate({ calm, power: stars === 3 ? 1.3 : 0.8 }), 900)
    if (finish.badges.length) window.setTimeout(() => sound('badge'), 2200)
    return () => window.clearTimeout(cue)
    // Once, on arrival: a re-render must not replay the fanfare.
  }, [])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
      <BuddyStage buddy={user?.buddy} className="flex flex-col items-center px-4 pt-24 pb-8 text-center">
        <Buddy ref={buddy} buddy={user?.buddy} size={180} mood={verdict === 'great' ? 'dance' : 'idle'} bubble="top" />
        <motion.h1
          initial={{ scale: 0.3, opacity: 0, rotate: -6 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ ...spring.bouncy, delay: 0.2 }}
          className="mt-2 font-celebrate text-5xl text-primary md:text-6xl"
        >
          {headline}
        </motion.h1>
        <p className="mt-1 font-display text-lg text-muted-foreground">{attempt.title}</p>
        {guide && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-kind-study-guide-vivid/12 px-3 py-1 text-sm font-bold text-kind-study-guide">
            Study guide complete — you read every part!
          </p>
        )}

        <div className="mt-6 flex flex-col items-center gap-5 sm:flex-row sm:gap-10">
          <ScoreRing percent={attempt.percent} score={attempt.score} total={attempt.max_score} label={flashcards ? 'knew' : 'right'} />
          <Stars count={stars} />
        </div>
      </BuddyStage>

      {finish.badges.length > 0 && (
        <section className="mt-8">
          <h2 className="text-center font-display text-2xl font-semibold">{finish.badges.length === 1 ? 'New badge!' : 'New badges!'}</h2>
          <motion.ul className="mt-4 flex flex-wrap justify-center gap-4" variants={stagger(0.25, 1.8)} initial="hidden" animate="shown">
            {finish.badges.map((badge) => (
              <motion.li key={badge.badge + badge.reason} variants={pop} className="flex w-44 flex-col items-center rounded-3xl border-2 border-border bg-surface p-4 text-center shadow">
                <BadgeMedal badge={badge.badge} size={76} />
                <p className="mt-2 font-display text-lg font-semibold">{badge.name}</p>
                <p className="text-sm text-muted-foreground">{badge.reason || badge.description}</p>
              </motion.li>
            ))}
          </motion.ul>
        </section>
      )}

      {finish.rank && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }} className="mt-8 flex flex-col items-center gap-3 rounded-3xl bg-sun-100 p-5 text-center sm:flex-row sm:text-left dark:bg-sun-600/20">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sun-400 font-celebrate text-2xl text-grape-900">#{finish.rank.rank}</span>
          <p className="flex-1 font-display text-lg font-semibold">
            You're number {finish.rank.rank} of {finish.ranked} on the class leaderboard!
          </p>
          {leaderboardTo && (
            <ButtonLink to={leaderboardTo} variant="sun">
              <Ranking weight="fill" className="size-5" />
              See the board
            </ButtonLink>
          )}
        </motion.div>
      )}

      {finish.skills.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">How each skill went</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {finish.skills.map((skill) => {
              const share = skill.total ? skill.correct / skill.total : 0
              return (
                <li key={skill.slug} className={cn('rounded-full px-4 py-1.5 font-bold', share >= 0.8 ? 'bg-correct-soft text-success' : share >= 0.5 ? 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300' : 'bg-wrong-soft text-destructive')}>
                  <span className="capitalize">{skill.label}</span> · {skill.correct}/{skill.total}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button size="lg" variant="outline" onClick={onReview}>
          <ClipboardText weight="bold" className="size-5" />
          {flashcards ? 'See my cards' : 'Check my answers'}
        </Button>
        {onRetake && (
          <Button size="lg" variant="sun" onClick={onRetake}>
            <ArrowClockwise weight="bold" className="size-5" />
            Try again
          </Button>
        )}
        <ButtonLink to="/" size="lg">
          <House weight="fill" className="size-5" />
          Home
        </ButtonLink>
      </div>
    </div>
  )
}

function ScoreRing({ percent, score, total, label }: { percent: number; score: number; total: number; label: string }) {
  const value = useMotionValue(0)
  const shown = useTransform(value, (v) => `${Math.round(v)}%`)
  const dash = useTransform(value, (v) => `${(v / 100) * 283} 283`)
  const tone = percent >= 70 ? 'hsl(var(--correct))' : percent >= 40 ? 'hsl(var(--star))' : 'hsl(var(--primary))'
  useEffect(() => {
    const controls = animate(value, percent, { duration: 1.4, delay: 0.4, ease: [0.2, 0.8, 0.2, 1] })
    return () => controls.stop()
  }, [value, percent])
  return (
    <div className="relative size-40">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx={50} cy={50} r={45} fill="none" stroke="hsl(var(--foreground) / 0.1)" strokeWidth={9} />
        <motion.circle cx={50} cy={50} r={45} fill="none" stroke={tone} strokeWidth={9} strokeLinecap="round" style={{ strokeDasharray: dash }} />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <motion.span className="font-celebrate text-4xl">{shown}</motion.span>
        <span className="text-sm font-bold text-muted-foreground">
          {score} of {total} {label}
        </span>
      </div>
    </div>
  )
}

function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-end gap-2" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => {
        const lit = i < count
        return (
          <motion.span
            key={i}
            initial={{ scale: 0, rotate: -120, y: 20 }}
            animate={{ scale: 1, rotate: 0, y: i === 1 ? -14 : 0 }}
            transition={{ ...spring.bouncy, delay: 1 + i * 0.35 }}
          >
            <Star
              weight="fill"
              className={cn('drop-shadow-md', i === 1 ? 'size-20' : 'size-16', lit ? 'text-star' : 'text-foreground/10')}
            />
          </motion.span>
        )
      })}
    </div>
  )
}
