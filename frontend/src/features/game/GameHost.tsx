/**
 * Playing a game (§26): a treasure map of islands, one idea each, played in
 * Mentora's own templates (`rounds/`), with the story told around it:
 *
 *   opening → the map → for each island: Learn it → its round
 *           → What you discovered, and back to the map → the ending
 *
 * Every move in a round is answered at once — right, or wrong and why, said
 * by the buddy. Once the child is stuck, *Show me* plays one right move. A
 * student's game reports each island to the server, which keeps it with the
 * pieces slipped on and counts the points; a maker's preview marks it on the
 * page; a replay of the missed islands (`practice`) keeps nothing at all.
 */
import { AnimatePresence, motion } from 'motion/react'
import { Lightbulb } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { Confirm } from '@/components/ui/Confirm'
import { Buddy, profileOf } from '@/features/buddies'
import type { GameIsland } from '@/features/play/api'
import type { PlayerProps } from '@/features/play/players'
import { usePlayVoice } from '@/features/play/usePlayVoice'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useAuth } from '@/lib/auth'
import { playSound, type Sound } from '@/lib/sound'
import { useCalmMotion } from '@/motion'
import { told, type Cast } from './cards'
import { GameBar } from './GameBar'
import { TreasureMap } from './Map'
import { overlayFor, type Phase, type Shown } from './overlay'
import { bandOf, Round, roundContent, type Band, type Move, type RoundContent } from './rounds'
import { HowToPlay } from './rounds/howto'
import { spokenFor } from './rounds/pieces'
import { useFullscreen } from './useFullscreen'
import { useIslands } from './useIslands'
import { isWorld, paint } from './worlds'

// Wrong moves on an island before "Show me" is offered: the youngest sooner.
const SHOW_ME_AFTER: Record<Band, number> = { early: 1, middle: 2, secondary: 2 }
const MOST_TRIES = 99

interface GameHostProps extends PlayerProps {
  /** Just these islands — a replay of the missed ones. */
  only?: string[]
  /** Nothing is kept: a replay after the game is finished. */
  practice?: boolean
}

export { told } from './cards'

export function GameHost({ attempt, buddy, exitTo, onFinished, only, practice = false }: GameHostProps) {
  const { user } = useAuth()
  const calm = useCalmMotion()
  const voice = usePlayVoice(attempt.id, attempt.language)
  const stage = useRef<HTMLDivElement>(null)
  const fullscreen = useFullscreen(stage)
  const run = useIslands(attempt, { only, practice })
  // Beside the game on a wide screen; on a narrow one the buddy's words go
  // in the line under the bar, where they cover nothing.
  const roomy = useMediaQuery('(min-width: 1280px)')
  const band = bandOf(attempt.grade_level)
  const world = isWorld(attempt.extras.world) ? attempt.extras.world : 'rainforest'
  const cast: Cast = { buddyKey: user?.buddy, buddyName: profileOf(user?.buddy).name, character: attempt.extras.character?.name ?? '' }
  const [phase, setPhase] = useState<Phase>(practice || attempt.answered.length > 0 ? 'map' : 'story')
  const [sound, setSound] = useState(true)
  const [shown, setShown] = useState<Shown | null>(null)
  // The island being played: set on the map, and kept until What you
  // discovered — the next island must not show while this one is being kept.
  const [active, setActive] = useState<GameIsland | null>(null)
  const [slips, setSlips] = useState<Record<string, string[]>>({})
  const [misses, setMisses] = useState<Record<string, number>>({})
  const [helped, setHelped] = useState<Set<string>>(() => new Set())
  const [showMe, setShowMe] = useState(0)
  const [line, setLine] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  // How to play, asked for from the bar in the middle of a round.
  const [asking, setAsking] = useState(false)
  const current = run.current
  const allIn = run.islands.every((m) => run.outcomes[m.id])

  const ring = (name: Sound) => sound && playSound(name)

  function say(text: string, island: GameIsland | null = active) {
    setLine(text)
    buddy.current?.say(told(text, cast.buddyName), 5000)
    // The youngest hear it too, in the tutor's voice, when it is a piece of
    // the round or why it goes where it does.
    const spoken = island && band === 'early' && voice.supported ? spokenFor(island, text) : null
    if (spoken) voice.read(`say-${island?.id}`, [{ spoken, text }])
  }

  function move(island: GameIsland, { piece, right }: Move) {
    if (right) return
    setMisses((all) => ({ ...all, [island.id]: (all[island.id] ?? 0) + 1 }))
    setSlips((all) => ({ ...all, [island.id]: [...new Set([...(all[island.id] ?? []), piece])] }))
  }

  async function cleared(island: GameIsland) {
    const tries = Math.min(MOST_TRIES, 1 + (misses[island.id] ?? 0))
    const outcome = await run.reach(island.id, tries, helped.has(island.id), slips[island.id] ?? [])
    if (!outcome) return
    ring('streak')
    buddy.current?.cue('correct')
    setLine(null)
    setShown({ island, outcome })
  }

  function next() {
    setShown(null)
    setActive(null)
    if (run.islands.every((m) => run.outcomes[m.id])) {
      ring('finish')
      setPhase('end')
    } else setPhase('map')
  }

  function help(island: GameIsland) {
    setHelped((all) => new Set(all).add(island.id))
    setShowMe((n) => n + 1)
    say(`Watch me, then it's your turn!`, null)
  }

  const overlay = overlayFor({
    attempt, run, cast, phase, shown, active, world, calm, voice, practice,
    onStart: () => setPhase('map'),
    onPlay: () => setPhase('play'),
    onNext: next,
    onFinished,
  })  // fmt: skip
  const playing = phase === 'play' && !shown && active !== null
  const stuck = playing && (misses[active.id] ?? 0) >= SHOW_ME_AFTER[band]
  const title = attempt.extras.title || attempt.title
  // What the buddy's corner names: the island being played, or the next one.
  const focus = active ?? current
  return (
    <div ref={stage} className="fixed inset-0 z-40 flex flex-col bg-background" data-game>
      <GameBar
        title={title}
        exitTo={exitTo}
        islands={run.islands}
        outcomes={run.outcomes}
        current={active ?? current}
        points={run.points}
        canHint={playing && !practice && Boolean(active?.has_hint)}
        // The hint shows under the bar; the buddy beside the game says it too.
        onHint={() => active && void run.hint(active.id).then((hint) => hint && buddy.current?.say(hint, 5000))}
        showMe={stuck && active ? () => help(active) : null}
        onHowTo={playing ? () => setAsking(true) : null}
        sound={sound}
        onSound={() => setSound((on) => !on)}
        fullscreen={fullscreen}
        onFinish={!allIn && (phase === 'map' || phase === 'play') ? () => setEnding(true) : null}
      />
      {playing && run.hints[active.id] && (
        <p role="status" className="flex items-start gap-2 border-b-2 border-border bg-star-soft px-4 py-2 font-semibold">
          <Lightbulb weight="fill" className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 break-words">{run.hints[active.id]}</span>
        </p>
      )}
      {line && !roomy && playing && (
        <p className="border-b-2 border-border bg-surface px-4 py-1.5 font-semibold" aria-live="polite">
          <span className="text-primary">{cast.buddyName}:</span> <span className="break-words">{told(line, cast.buddyName)}</span>
        </p>
      )}
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          {playing ? (
            <section aria-label={`Island ${run.islands.indexOf(active) + 1}`} className="absolute inset-0 flex flex-col" style={{ background: `linear-gradient(180deg, ${paint(world, 'sky')}, ${paint(world, 'haze')})` }}>
              <p className="mx-3 mt-3 flex items-start gap-2 rounded-2xl bg-surface/95 px-4 py-2 font-display text-lg font-semibold shadow-sm sm:mx-auto sm:max-w-3xl">
                {active.icon && <span aria-hidden>{active.icon}</span>}
                <span className="min-w-0 break-words">{told(active.task, cast.buddyName)}</span>
              </p>
              <div className="relative min-h-0 flex-1">
                <Round
                  key={active.id}
                  {...roundOf(active)}
                  band={band}
                  calm={calm}
                  say={(text) => say(text)}
                  sound={ring}
                  showMe={showMe}
                  onMove={(m) => move(active, m)}
                  onDone={() => void cleared(active)}
                />
              </div>
            </section>
          ) : (
            <TreasureMap
              title={title}
              world={world}
              islands={run.islands}
              outcomes={run.outcomes}
              stars={run.stars}
              current={phase === 'map' ? current : null}
              buddyKey={user?.buddy}
              calm={calm}
              onGo={(island) => {
                setActive(island)
                setPhase('learn')
              }}
            />
          )}
          <AnimatePresence>
            {playing && asking && (
              <motion.div key="how" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 grid place-items-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-[2px]">
                <section role="dialog" aria-label="How to play" className="w-full max-w-md space-y-3 rounded-3xl border-4 border-surface bg-surface p-4 shadow-lg">
                  <HowToPlay play={active.play} language={attempt.language} calm={calm} />
                  <Button variant="sun" size="lg" className="w-full" onClick={() => setAsking(false)} autoFocus>
                    Back to the game
                  </Button>
                </section>
              </motion.div>
            )}
            {overlay && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 grid place-items-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-[2px]">
                {overlay}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {roomy && (
          <aside className="flex w-64 shrink-0 flex-col items-center gap-3 border-l-2 border-border bg-surface p-4 pt-24" aria-label="Your buddy">
            <Buddy ref={buddy} buddy={user?.buddy} size={150} bubble="top" speaks own />
            {focus && <IslandNote island={focus} number={run.islands.indexOf(focus) + 1} total={run.islands.length} />}
          </aside>
        )}
      </div>
      {ending && (
        <Confirm
          title="Finish the game now?"
          body="Islands you haven't cleared score nothing — you can play again after."
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

/** Beside the game: which island, and its idea. */
function IslandNote({ island, number, total }: { island: GameIsland; number: number; total: number }) {
  return (
    <p className="break-words text-center font-semibold">
      <span className="block text-sm uppercase tracking-wide text-primary">
        Island {number} of {total}
      </span>
      {island.icon && <span className="mr-1" aria-hidden>{island.icon}</span>}
      {island.learn}
    </p>
  )
}

/** The round an island is played in, with its content, for `Round` — its
 *  pairs as a Match Up should its own round be missing. */
function roundOf(island: GameIsland): RoundContent {
  return roundContent(island) ?? { play: 'match', content: island.match ?? { pairs: [] } }
}
