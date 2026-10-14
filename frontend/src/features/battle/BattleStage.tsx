/**
 * A Class Battle on the class screen (§28.3.6): the teacher's projector.
 * The lobby fills with each student's buddy as they join on their own
 * device; then each question shows big, with the clock, how many have
 * answered, and the rope or the boss moving as right answers come in. The
 * answer and why show between questions. The end celebrates every team.
 */
import { motion } from 'motion/react'
import { ArrowRight, FlagCheckered, Play, X } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Button } from '@/components/ui'
import { errorMessage } from '@/features/auth/errors'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { MARKERS } from '@/features/play/QuizOptions'
import { battleApi, type BattleView } from './api'
import { Clock, Field, Finale, Teams } from './parts'
import { useBattle } from './useBattle'


export default function BattleStage() {
  const { id = '' } = useParams()
  const { view, problem, setView } = useBattle(id)
  const [busy, setBusy] = useState(false)
  const [trouble, setTrouble] = useState<string | null>(null)

  async function act(action: (id: string) => Promise<BattleView>) {
    setBusy(true)
    setTrouble(null)
    try {
      setView(await action(id))
    } catch (error) {
      setTrouble(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-sky-100 to-background dark:from-sky-700/20">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <Link to="/library" aria-label="Leave the battle screen" className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-hover">
          <X weight="bold" className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{view?.mode === 'boss' ? 'Class vs Boss' : 'Tug-of-War'}</p>
          <h1 className="break-words font-display text-xl font-semibold">{view?.title ?? 'Class Battle'}</h1>
        </div>
        {view && <Controls view={view} busy={busy} onStart={() => void act(battleApi.start)} onNext={() => void act(battleApi.next)} onEnd={() => void act(battleApi.end)} />}
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 sm:p-6">
        {(problem || trouble) && <Alert>{trouble ?? problem}</Alert>}
        {!view ? null : view.phase === 'lobby' ? (
          <Lobby view={view} />
        ) : view.phase === 'done' ? (
          <Finale view={view} />
        ) : (
          <Round view={view} />
        )}
      </main>
    </div>
  )
}

function Controls({ view, busy, onStart, onNext, onEnd }: { view: BattleView; busy: boolean; onStart: () => void; onNext: () => void; onEnd: () => void }) {
  if (view.phase === 'done') {
    return (
      <Link to="/library" className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground">
        Done
      </Link>
    )
  }
  return (
    <div className="flex flex-wrap gap-2">
      {view.phase === 'lobby' ? (
        <Button variant="sun" size="lg" onClick={onStart} loading={busy} disabled={view.players === 0}>
          <Play weight="fill" className="size-5" />
          Start
        </Button>
      ) : (
        <Button variant="outline" onClick={onNext} loading={busy}>
          {view.phase === 'question' ? 'Show the answer' : 'Next question'}
          <ArrowRight weight="bold" className="size-5" />
        </Button>
      )}
      <Button variant="ghost" onClick={onEnd} disabled={busy}>
        <FlagCheckered weight="bold" className="size-5" />
        End
      </Button>
    </div>
  )
}

function Lobby({ view }: { view: BattleView }) {
  return (
    <>
      <section className="rounded-[2rem] bg-surface p-6 text-center shadow-sm">
        <p className="font-celebrate text-4xl sm:text-5xl">Join the battle!</p>
        <p className="mt-2 text-xl text-muted-foreground">Open Mentora on your device and tap <b>Join the battle</b>.</p>
        <p className="mt-1 text-lg font-bold">{view.players} {view.players === 1 ? 'player' : 'players'} in</p>
      </section>
      <Teams teams={view.teams} big />
    </>
  )
}

function Round({ view }: { view: BattleView }) {
  const question = view.question
  return (
    <>
      <Field view={view} big />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-xl font-semibold">
          Question {view.number} of {view.total}
        </p>
        <p className="font-bold text-muted-foreground">
          {view.answered} of {view.players} answered
        </p>
        {view.phase === 'question' && <Clock seconds={view.seconds_left} big />}
      </div>
      {question && (
        <motion.section key={view.number} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={spring.gentle} aria-live="polite" className="rounded-[2rem] bg-surface p-5 shadow-md sm:p-8">
          <h2 className="break-words text-center font-display text-3xl font-semibold md:text-5xl">{question.ask}</h2>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {question.options.map((option, n) => (
              <li key={n} className={cn('flex items-center gap-3 rounded-2xl border-4 p-4 text-xl font-bold md:text-2xl', view.reveal ? (n === view.reveal.answer ? 'border-correct bg-correct-soft' : 'border-border opacity-50') : 'border-border')}>
                <Marker n={n} />
                <span className="min-w-0 break-words">{option}</span>
              </li>
            ))}
          </ul>
          {view.reveal?.why && <p className="mt-4 break-words rounded-2xl bg-correct-soft px-4 py-3 text-center text-lg md:text-xl">{view.reveal.why}</p>}
        </motion.section>
      )}
    </>
  )
}

/** The tile's shape and colour, as on every device: "the blue diamond". */
function Marker({ n }: { n: number }) {
  const marker = MARKERS[n % MARKERS.length]
  return (
    <span aria-hidden className={cn('grid size-12 shrink-0 place-items-center rounded-xl text-white shadow-press', marker.tile)}>
      <marker.Icon weight="fill" className="size-7" />
    </span>
  )
}
