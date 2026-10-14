/**
 * A Class Battle on a student's own device (§28.3.6). They join their team,
 * wait in the lobby with their buddy, then answer each question on the
 * class screen with the same four tiles as a quiz. Their answer locks in;
 * right or wrong shows when the class sees the answer. Nothing here ranks
 * anyone: the end celebrates every team.
 */
import { motion } from 'motion/react'
import { LockSimple, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert } from '@/components/ui'
import { errorMessage } from '@/features/auth/errors'
import { Buddy } from '@/features/buddies'
import type { Played, QuizItem } from '@/features/play/api'
import { usePlayLook } from '@/features/play/level'
import { Options } from '@/features/play/QuizOptions'
import { useAuth } from '@/lib/auth'
import { buzz, BUZZ } from '@/lib/haptics'
import { useSoundOn } from '@/lib/prefs'
import { useSound } from '@/lib/sound'
import { spring } from '@/motion'
import { battleApi, type BattleView } from './api'
import { Clock, Field, Finale, Teams } from './parts'
import { useBattle } from './useBattle'

export default function BattlePlay() {
  const { id = '' } = useParams()
  const [joined, setJoined] = useState<BattleView | null>(null)
  const [trouble, setTrouble] = useState<string | null>(null)

  useEffect(() => {
    battleApi.join(id).then(setJoined, (error: unknown) => setTrouble(errorMessage(error)))
  }, [id])

  if (trouble) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Alert>{trouble}</Alert>
        <Link to="/" className="mt-4 inline-block font-bold text-primary underline">Back home</Link>
      </div>
    )
  }
  if (!joined) return <p className="p-6 text-center font-bold">Joining the battle…</p>
  return <Playing id={id} first={joined} />
}

function Playing({ id, first }: { id: string; first: BattleView }) {
  const { view: live, problem } = useBattle(id, first)
  const view = live ?? first
  const team = view.teams.find((t) => t.key === view.you?.team)
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-sky-100 to-background dark:from-sky-700/20">
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <Link to="/" aria-label="Leave the battle" className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-hover">
          <X weight="bold" className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 break-words font-display text-lg font-semibold">{view.title}</h1>
        {team && (
          <span className="shrink-0 rounded-full bg-surface px-3 py-1 font-bold shadow-sm">
            {team.icon} {team.name}
          </span>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
        {problem && <Alert>{problem}</Alert>}
        {view.phase === 'lobby' && <Waiting view={view} />}
        {(view.phase === 'question' || view.phase === 'reveal') && <Answering id={id} view={view} />}
        {view.phase === 'done' && <Finale view={view} />}
      </main>
    </div>
  )
}

function Waiting({ view }: { view: BattleView }) {
  const { user } = useAuth()
  const team = view.teams.find((t) => t.key === view.you?.team)
  return (
    <>
      <section className="flex flex-col items-center gap-2 rounded-[2rem] bg-surface p-6 text-center shadow-sm">
        <Buddy buddy={user?.buddy} size={120} mood="dance" interactive={false} own />
        <p className="font-celebrate text-3xl">{team ? `You're on ${team.name}! ${team.icon}` : "You're in!"}</p>
        <p className="text-muted-foreground">Waiting for your teacher to start…</p>
      </section>
      <Teams teams={view.teams} />
    </>
  )
}

function Answering({ id, view }: { id: string; view: BattleView }) {
  const look = usePlayLook()
  const sound = useSound()
  const soundOn = useSoundOn()
  const [mine, setMine] = useState<number | null>(view.you?.choice ?? null)
  const [problem, setProblem] = useState<string | null>(null)
  const heard = useRef<number | null>(null)
  const question = view.question
  const choice = view.you?.choice ?? mine

  // A new question: hands free again.
  useEffect(() => setMine(view.you?.choice ?? null), [view.number, view.you?.choice])

  // Right or wrong, once, when the class sees the answer.
  useEffect(() => {
    if (!view.reveal || choice === null || heard.current === view.number) return
    heard.current = view.number
    const right = choice === view.reveal.answer
    sound(right ? 'correct' : 'wrong')
    if (right) buzz(BUZZ.right, soundOn)
  }, [view.reveal, view.number, choice, sound, soundOn])

  async function answer(n: number) {
    if (choice !== null || view.phase !== 'question') return
    setMine(n)
    sound('tap')
    try {
      await battleApi.answer(id, n)
    } catch (error) {
      setMine(null)
      setProblem(errorMessage(error))
    }
  }

  if (!question) return null
  const item: QuizItem = { id: `battle-${view.number}`, prompt: question.ask, options: question.options, skill: '', difficulty: '' }
  const played: Played | undefined =
    choice === null ? undefined : { item_id: item.id, choice, knew: null, correct: view.reveal ? choice === view.reveal.answer : null, reveal: view.reveal ? { answer: view.reveal.answer, explanation: view.reveal.why } : null }
  return (
    <>
      <Field view={view} />
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-lg font-semibold">
          Question {view.number} of {view.total}
        </p>
        {view.phase === 'question' && <Clock seconds={view.seconds_left} />}
      </div>
      <motion.h2 key={view.number} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.gentle} className="break-words rounded-3xl bg-surface p-4 font-display text-2xl font-semibold shadow-sm">
        {question.ask}
      </motion.h2>
      <Options item={item} answer={played} instant={Boolean(view.reveal)} disabled={choice !== null || view.phase !== 'question'} look={look} onChoose={(n) => void answer(n)} />
      {problem && <Alert>{problem}</Alert>}
      <Said view={view} choice={choice} />
    </>
  )
}

function Said({ view, choice }: { view: BattleView; choice: number | null }) {
  if (view.phase === 'question') {
    return choice === null ? null : (
      <p className="flex items-center justify-center gap-2 rounded-2xl bg-selected p-3 font-bold" role="status">
        <LockSimple weight="fill" className="size-5" aria-hidden /> Locked in! Watch the class screen.
      </p>
    )
  }
  const right = view.reveal && choice === view.reveal.answer
  return (
    <p className="rounded-2xl bg-surface p-3 text-center font-bold" role="status">
      {choice === null ? 'Time! Get ready for the next one.' : right ? (view.mode === 'boss' ? 'Hit! The boss felt that!' : 'Right! Your team pulls!') : 'Not this time. The next one is yours!'}
    </p>
  )
}
