/**
 * Playing a simulation game (§24, §25): the game itself in a sandboxed frame —
 * model-written code, served on its own address with no way out but the
 * runtime's messages (`bridge.ts`) — and around it, Mentora telling the story
 * and teaching, one small idea at a time:
 *
 *   opening → for each mission: Learn it → (the game) Try it, Do it
 *           → What you discovered, and the story moves on → the ending
 *
 * After two misses at a mission, *Show me*: the game plays it while the child
 * watches. A student's game reports each mission to the server, which keeps
 * it and counts the points; a maker's preview marks it on the page; a replay
 * of the missed missions (`practice`) keeps nothing at all.
 */
import { AnimatePresence, motion } from 'motion/react'
import { CircleNotch, Lightbulb } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Confirm } from '@/components/ui/Confirm'
import { Buddy, profileOf } from '@/features/buddies'
import type { GameMission } from '@/features/play/api'
import { usePlayBackend } from '@/features/play/backend'
import type { PlayerProps } from '@/features/play/players'
import { usePlayVoice } from '@/features/play/usePlayVoice'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useAuth } from '@/lib/auth'
import { useCalmMotion } from '@/motion'
import { tellGame, useGameMessages, type GameMessage } from './bridge'
import { type Cast } from './cards'
import { GameBar } from './GameBar'
import { overlayFor, type Shown } from './overlay'
import { useFullscreen } from './useFullscreen'
import { useMissions } from './useMissions'

type Phase = 'story' | 'play' | 'end'
// The buddy speaks for the game at most this often.
const SAY_EVERY_MS = 3000
// Misses at a mission before "Show me" is offered.
const SHOW_ME_AFTER = 2

interface GameHostProps extends PlayerProps {
  /** Just these missions — a replay of the missed ones. */
  only?: string[]
  /** Nothing is kept: a replay after the game is finished. */
  practice?: boolean
}

export { told } from './cards'

export function GameHost({ attempt, buddy, exitTo, onFinished, only, practice = false }: GameHostProps) {
  const { user } = useAuth()
  const backend = usePlayBackend()
  const calm = useCalmMotion()
  const voice = usePlayVoice(attempt.id, attempt.language)
  const stage = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const fullscreen = useFullscreen(stage)
  const run = useMissions(attempt, { only, practice })
  // Beside the game on a wide screen; on a narrow one the buddy's words go
  // in the line under the bar, so no bubble lands on the game's controls.
  const roomy = useMediaQuery('(min-width: 1280px)')
  const cast: Cast = { buddyKey: user?.buddy, buddyName: profileOf(user?.buddy).name, character: attempt.extras.character?.name ?? '' }
  const [phase, setPhase] = useState<Phase>(practice || attempt.answered.length > 0 ? 'play' : 'story')
  const [ready, setReady] = useState(false)
  const [sound, setSound] = useState(true)
  const [shown, setShown] = useState<Shown | null>(null)
  const [learnt, setLearnt] = useState<Set<string>>(() => new Set(practice ? [] : attempt.answered.map((p) => p.item_id)))
  const [misses, setMisses] = useState<Record<string, number>>({})
  const [helped, setHelped] = useState<Set<string>>(() => new Set())
  const [line, setLine] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const said = useRef(0)
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
    else if (message.type === 'tried') setMisses((all) => ({ ...all, [message.id]: message.tries }))
    else if (message.type === 'done') void reach(message.id, message.tries)
  })

  async function reach(id: string, tries: number) {
    const outcome = await run.reach(id, tries, helped.has(id))
    const mission = run.missions.find((m) => m.id === id)
    if (!outcome || !mission) return
    buddy.current?.cue('correct')
    setShown({ mission, outcome })
  }

  function showMe(mission: GameMission) {
    setHelped((all) => new Set(all).add(mission.id))
    frame.current?.contentWindow?.postMessage({ source: 'mentora-host', type: 'show', id: mission.id }, '*')
    speak(`Watch me, then it's your turn!`)
  }

  useEffect(() => tellGame(frame.current, 'sound', sound), [sound])
  useEffect(() => {
    // Picked up with every mission already in: straight to the end.
    if (allIn && !shown && phase === 'play') setPhase('end')
  }, [allIn, shown, phase])

  const current = run.current
  const overlay = overlayFor({
    attempt, run, cast, phase, shown, voice, practice,
    learning: phase === 'play' && !shown && current !== null && !learnt.has(current.id),
    onStart: () => setPhase('play'),
    onLearnt: (id) => setLearnt((all) => new Set(all).add(id)),
    onNext: () => setShown(null),
    onFinished,
  })  // fmt: skip
  const stuck = phase === 'play' && !shown && current !== null && (misses[current.id] ?? 0) >= SHOW_ME_AFTER && !helped.has(current.id)
  const title = attempt.extras.title || attempt.title
  return (
    <div ref={stage} className="fixed inset-0 z-40 flex flex-col bg-background" data-game>
      <GameBar
        title={title}
        exitTo={exitTo}
        missions={run.missions}
        outcomes={run.outcomes}
        current={current}
        points={run.points}
        canHint={phase === 'play' && !practice && Boolean(current?.has_hint) && !overlay}
        // The hint shows under the bar; the buddy beside the game says it too.
        onHint={() => current && void run.hint(current.id).then((hint) => hint && buddy.current?.say(hint, 5000))}
        showMe={stuck && current ? () => showMe(current) : null}
        sound={sound}
        onSound={() => setSound((on) => !on)}
        fullscreen={fullscreen}
        onFinish={phase === 'play' && !allIn ? () => setEnding(true) : null}
      />
      {current && run.hints[current.id] && (
        <p role="status" className="flex items-start gap-2 border-b-2 border-border bg-star-soft px-4 py-2 font-semibold">
          <Lightbulb weight="fill" className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 break-words">{run.hints[current.id]}</span>
        </p>
      )}
      {line && !roomy && (
        <p className="border-b-2 border-border bg-surface px-4 py-1.5 text-sm font-semibold" aria-live="polite">
          <span className="text-primary">{cast.buddyName}:</span> <span className="break-words">{line}</span>
        </p>
      )}
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          <iframe
            ref={frame}
            title={`The game: ${title}`}
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
            {current && (
              <p className="break-words text-center font-semibold">
                <span className="block text-sm uppercase tracking-wide text-primary">
                  Mission {run.missions.indexOf(current) + 1} of {run.missions.length}
                </span>
                {current.icon && <span className="mr-1" aria-hidden>{current.icon}</span>}
                {current.learn}
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
