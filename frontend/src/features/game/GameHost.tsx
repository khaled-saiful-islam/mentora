/**
 * Playing a simulation game (§24): the game itself in a sandboxed frame —
 * model-written code, served on its own address with no way out but the
 * runtime's messages (`bridge.ts`) — and around it, Mentora: the story's
 * opening, the bar with the missions and points, the buddy, what each mission
 * taught, and the finale.
 *
 * A student's game reports each mission to the server, which keeps it and
 * counts the points; a maker's preview marks it on the page; a replay of the
 * missed missions (`practice`) keeps nothing at all.
 */
import { AnimatePresence, motion } from 'motion/react'
import { CircleNotch, Lightbulb } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Confirm } from '@/components/ui/Confirm'
import { Buddy, profileOf } from '@/features/buddies'
import type { GameMission } from '@/features/play/api'
import { usePlayBackend } from '@/features/play/backend'
import type { PlayerProps } from '@/features/play/players'
import { usePlayVoice, type Line } from '@/features/play/usePlayVoice'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useAuth } from '@/lib/auth'
import { useCalmMotion } from '@/motion'
import { tellGame, useGameMessages, type GameMessage } from './bridge'
import { Discovery, Finale, StoryCard, type Telling } from './cards'
import { GameBar } from './GameBar'
import { useFullscreen } from './useFullscreen'
import { useMissions, type Outcome } from './useMissions'

type Phase = 'story' | 'play' | 'end'
// The buddy speaks for the game at most this often.
const SAY_EVERY_MS = 3000

interface GameHostProps extends PlayerProps {
  /** Just these missions — a replay of the missed ones. */
  only?: string[]
  /** Nothing is kept: a replay after the game is finished. */
  practice?: boolean
}

/** A line of the story with the player's own buddy named. */
export const told = (text: string | undefined, buddy: string) => (text ?? '').split('{buddy}').join(buddy)

export function GameHost({ attempt, buddy, exitTo, onFinished, only, practice = false }: GameHostProps) {
  const { user } = useAuth()
  const backend = usePlayBackend()
  const calm = useCalmMotion()
  const voice = usePlayVoice(attempt.id, attempt.language)
  const stage = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const fullscreen = useFullscreen(stage)
  const run = useMissions(attempt, { only, practice })
  // The buddy on screen is the one the story names — a maker previewing
  // without a buddy of their own sees, and reads about, the first one.
  const name = profileOf(user?.buddy).name
  // Beside the game on a wide screen; on a narrow one the buddy's words go
  // in the line under the bar, so no bubble lands on the game's controls.
  const roomy = useMediaQuery('(min-width: 1280px)')
  const story = attempt.extras.story
  const [phase, setPhase] = useState<Phase>(practice || attempt.answered.length > 0 ? 'play' : 'story')
  const [ready, setReady] = useState(false)
  const [sound, setSound] = useState(true)
  const [shown, setShown] = useState<{ mission: GameMission; outcome: Outcome } | null>(null)
  const [line, setLine] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const said = useRef(0)
  const total = run.missions.length
  const reached = run.missions.filter((m) => run.outcomes[m.id]?.reached).length
  const allIn = run.missions.every((m) => run.outcomes[m.id])

  const speak = (text: string) => {
    if (Date.now() - said.current < SAY_EVERY_MS) return
    said.current = Date.now()
    setLine(text)
    buddy.current?.say(text, 4500)
  }

  useGameMessages(frame, (message: GameMessage) => {
    if (message.type === 'ready') {
      setReady(true)
      tellGame(frame.current, 'calm', calm)
      tellGame(frame.current, 'sound', sound)
    } else if (message.type === 'say') speak(message.text)
    else if (message.type === 'done') void reach(message.id, message.tries)
  })

  async function reach(id: string, tries: number) {
    const outcome = await run.reach(id, tries)
    const mission = run.missions.find((m) => m.id === id)
    if (!outcome || !mission) return
    buddy.current?.cue('correct')
    setShown({ mission, outcome })
  }

  useEffect(() => tellGame(frame.current, 'sound', sound), [sound])
  useEffect(() => {
    // Picked up with every mission already in: straight to the end.
    if (allIn && !shown && phase === 'play') setPhase('end')
  }, [allIn, shown, phase])

  const telling = (key: string, lines: Line[]): Telling => ({
    reading: voice.reading === key,
    readable: voice.supported && lines.length > 0,
    toggle: () => (voice.reading === key ? voice.stop() : voice.read(key, lines)),
  })
  const storyLines = (pieces: ('hook' | 'goal' | 'win')[]): Line[] =>
    pieces.filter((p) => story?.[p]).map((p) => ({ spoken: { item: p, part: 'story' }, text: told(story?.[p], name) }))

  const overlay = phase === 'story' ? (
    <StoryCard
      title={attempt.extras.title || attempt.title}
      hook={told(story?.hook, name)}
      goal={told(story?.goal, name)}
      count={total}
      telling={telling('story', storyLines(['hook', 'goal']))}
      onStart={() => setPhase('play')}
    />
  ) : shown ? (
    <Discovery
      number={run.missions.indexOf(shown.mission) + 1}
      goal={shown.mission.goal}
      reached={shown.outcome.reached}
      explanation={shown.outcome.explanation}
      last={allIn}
      telling={telling(`why-${shown.mission.id}`, shown.outcome.explanation ? [{ spoken: { item: shown.mission.id, part: 'explanation' }, text: shown.outcome.explanation }] : [])}
      onNext={() => setShown(null)}
    />
  ) : phase === 'end' ? (
    <Finale
      win={told(story?.win, name)}
      reached={reached}
      total={total}
      points={run.points}
      telling={telling('win', storyLines(['win']))}
      doneLabel={practice ? 'Back to my score' : 'See my points'}
      onDone={onFinished}
    />
  ) : null

  return (
    <div ref={stage} className="fixed inset-0 z-40 flex flex-col bg-background" data-game>
      <GameBar
        title={attempt.extras.title || attempt.title}
        exitTo={exitTo}
        missions={run.missions}
        outcomes={run.outcomes}
        current={run.current}
        points={run.points}
        canHint={phase === 'play' && !practice && Boolean(run.current?.has_hint)}
        // The hint shows under the bar; the buddy beside the game says it too.
        onHint={() => run.current && void run.hint(run.current.id).then((hint) => hint && buddy.current?.say(hint, 5000))}
        sound={sound}
        onSound={() => setSound((on) => !on)}
        fullscreen={fullscreen}
        onFinish={phase === 'play' && !allIn ? () => setEnding(true) : null}
      />
      {run.current && run.hints[run.current.id] && (
        <p role="status" className="flex items-start gap-2 border-b-2 border-border bg-star-soft px-4 py-2 font-semibold">
          <Lightbulb weight="fill" className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 break-words">{run.hints[run.current.id]}</span>
        </p>
      )}
      {line && !roomy && (
        <p className="border-b-2 border-border bg-surface px-4 py-1.5 text-sm font-semibold" aria-live="polite">
          <span className="text-primary">{name}:</span> <span className="break-words">{line}</span>
        </p>
      )}
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          <iframe
            ref={frame}
            title={`The game: ${attempt.extras.title || attempt.title}`}
            src={backend.game(attempt.id, only)}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            className="absolute inset-0 size-full border-0 bg-surface"
          />
          {!ready && (
            <div className="absolute inset-0 grid place-items-center bg-surface" aria-live="polite">
              <p className="flex items-center gap-2 font-display text-lg font-semibold text-muted-foreground">
                <CircleNotch weight="bold" className="size-6 animate-spin" aria-hidden />
                Getting the game ready…
              </p>
            </div>
          )}
          <AnimatePresence>
            {overlay && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 grid place-items-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-[2px]">
                {overlay}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {roomy && (
        <aside className="flex w-64 shrink-0 flex-col items-center gap-3 border-l-2 border-border bg-surface p-4 pt-24" aria-label="Your buddy">
          <Buddy ref={buddy} buddy={user?.buddy} size={150} bubble="top" speaks />
          {run.current && (
            <p className="break-words text-center font-semibold">
              <span className="block text-sm uppercase tracking-wide text-primary">Mission {run.missions.indexOf(run.current) + 1} of {total}</span>
              {run.current.goal}
            </p>
          )}
        </aside>
        )}
      </div>
      {ending && (
        <Confirm
          title="Finish the game now?"
          body="Missions you haven't reached score nothing — you can play again after."
          confirmLabel="Finish"
          destructive={false}
          onCancel={() => setEnding(false)}
          onConfirm={() => {
            setEnding(false)
            void run.giveUp().then(() => setPhase('end'))
          }}
        />
      )}
    </div>
  )
}
