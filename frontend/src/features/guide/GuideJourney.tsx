/**
 * Learn → Practise → Play on the guide's page (§28.3.8).
 *
 * - `PartPractice`: after a part's teaching, its one-minute game, opened full
 *   screen (`RoundSheet`), before the part's check.
 * - `GuideFinale`: at the end, the trail of parts — lit as each is finished,
 *   with the buddy walking to the last one — and what finishing unlocks:
 *   the guide's Boss Battle and a short quiz.
 */
import { motion } from 'motion/react'
import { Check, Exam, GameController, LockSimple, Play, Sword } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { BuddyAvatar } from '@/features/buddies'
import { PLAY_LABELS } from '@/features/game/rounds'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { spring, useCalmMotion } from '@/motion'
import type { PartRound } from './journey'

export function PartPractice({ rounds, played, onPlay }: { rounds: PartRound[]; played: boolean; onPlay: () => void }) {
  if (rounds.length === 0) return null
  const names = rounds.map((r) => PLAY_LABELS[r.play]).join(' and ')
  return (
    <section aria-label="Practise" className="mt-8 flex flex-wrap items-center gap-4 rounded-[2rem] border-2 border-kind-games-vivid/40 bg-kind-games-vivid/10 p-4 sm:p-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-kind-games-vivid text-white shadow-press" aria-hidden>
        <GameController weight="fill" className="size-7" />
      </span>
      <div className="min-w-[min(100%,14rem)] flex-1">
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Practise · about a minute</p>
        <p className="break-words font-display text-xl font-semibold">{names}</p>
      </div>
      <Button size="lg" variant={played ? 'outline' : 'primary'} onClick={onPlay}>
        {played ? <Check weight="bold" className="size-5" /> : <Play weight="fill" className="size-5" />}
        {played ? 'Play again' : 'Play'}
      </Button>
    </section>
  )
}

interface Stop {
  heading: string
  done: boolean
}

export function GuideFinale({
  stops,
  boss,
  quiz,
  onBoss,
  onQuiz,
  quizBusy,
}: {
  stops: Stop[]
  /** The Boss Battle: none when the guide has too few words, or for Year 1–2. */
  boss: { beaten: boolean } | null
  /** The quiz can be made here: not in a teacher's preview. */
  quiz: boolean
  onBoss: () => void
  onQuiz: () => void
  quizBusy: boolean
}) {
  const unlocked = stops.length > 0 && stops.every((s) => s.done)
  const left = stops.filter((s) => !s.done).length
  return (
    <section aria-labelledby="journey-title" className="rounded-[2rem] border-2 border-border bg-surface p-5 sm:p-6">
      <h2 id="journey-title" className="font-display text-2xl font-semibold">
        Your journey
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {unlocked ? 'Every part done. The boss and the quiz are open!' : `${left} ${left === 1 ? 'part' : 'parts'} to go to open the boss and the quiz.`}
      </p>
      <Trail stops={stops} />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {boss && (
          <Unlock
            icon={<Sword weight="fill" className="size-6" />}
            title="Boss Battle"
            body={boss.beaten ? 'Beaten! Play it again any time.' : 'Every word you learnt, against the boss.'}
            action={boss.beaten ? 'Fight again' : 'Fight the boss'}
            open={unlocked}
            onClick={onBoss}
          />
        )}
        {quiz && <Unlock icon={<Exam weight="fill" className="size-6" />} title="Short quiz" body="Questions from this guide, with a second chance." action="Take the quiz" open={unlocked} onClick={onQuiz} busy={quizBusy} />}
      </div>
    </section>
  )
}

/** The parts as stops on a path, lit when finished; the buddy stands at the
 *  last one finished, and walks on as the next is. */
function Trail({ stops }: { stops: Stop[] }) {
  const { user } = useAuth()
  const calm = useCalmMotion()
  const at = stops.reduce((last, s, n) => (s.done ? n : last), -1)
  return (
    <ol className="relative mt-4 space-y-2 before:absolute before:top-4 before:bottom-4 before:left-[1.2rem] before:border-l-4 before:border-dotted before:border-border" aria-label="Parts of the guide">
      {stops.map((stop, n) => (
        <li key={n} className="relative flex min-h-11 items-center gap-3" aria-label={`Part ${n + 1}: ${stop.heading}${stop.done ? ', done' : ''}`}>
          <motion.span
            className={cn('relative z-[1] grid size-10 shrink-0 place-items-center rounded-full border-4 font-display font-bold', stop.done ? 'border-sun-400 bg-sun-300 text-grape-900 shadow-[0_0_0_6px] shadow-sun-300/40' : 'border-border bg-surface text-muted-foreground')}
            initial={false}
            animate={stop.done && !calm ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {stop.done ? <Check weight="bold" className="size-5" /> : n + 1}
          </motion.span>
          <span className={cn('min-w-0 flex-1 break-words font-semibold', !stop.done && 'text-muted-foreground')}>{stop.heading}</span>
          {n === at && (
            <motion.span layoutId={calm ? undefined : 'trail-buddy'} transition={spring.gentle} className="shrink-0" aria-hidden>
              <motion.span className="block" animate={calm ? undefined : { y: [0, -5, 0] }} transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.6 }}>
                <BuddyAvatar buddy={user?.buddy} mood="happy" size={40} />
              </motion.span>
            </motion.span>
          )}
        </li>
      ))}
    </ol>
  )
}

function Unlock({ icon, title, body, action, open, onClick, busy = false }: { icon: React.ReactNode; title: string; body: string; action: string; open: boolean; onClick: () => void; busy?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-3xl border-2 p-4', open ? 'border-sun-400 bg-sun-100/60 dark:bg-sun-600/15' : 'border-dashed border-border bg-muted/40')}>
      <div className="flex items-start gap-3">
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', open ? 'bg-sun-400 text-grape-900' : 'bg-muted text-muted-foreground')} aria-hidden>
          {open ? icon : <LockSimple weight="fill" className="size-6" />}
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold">{title}</p>
          <p className="break-words text-sm text-muted-foreground">{open ? body : 'Finish every part to open it.'}</p>
        </div>
      </div>
      <Button variant={open ? 'sun' : 'outline'} disabled={!open} loading={busy} onClick={onClick} className="w-full sm:w-auto sm:self-start">
        {action}
      </Button>
    </div>
  )
}
