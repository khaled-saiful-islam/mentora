/**
 * The treasure map (§26, §26.8): a game's islands on a winding path across its
 * world, one idea each, in the order they are played — and each world's stops
 * look like that world: sandy islands on the reef, tree-top camps in the
 * rainforest, stilt houses in the kampung, train stations in KL, planets in
 * space. A cleared stop shows its stars; the one to play next glows, with the
 * buddy waiting on it; the rest are under fog until the one before is
 * cleared. A stop given up on stays foggy — one to clear again.
 */
import { motion } from 'motion/react'
import { Check, Play } from '@phosphor-icons/react'
import type { CSSProperties } from 'react'
import { BuddyAvatar } from '@/features/buddies'
import type { GameWorld } from '@/features/learning/api'
import type { GameIsland } from '@/features/play/api'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { Stars } from './cards'
import { PLAY_LABELS } from './rounds'
import type { Outcome } from './useIslands'
import { paint } from './worlds'

type State = 'cleared' | 'foggy' | 'next' | 'waiting'

interface MapProps {
  title: string
  world: GameWorld
  islands: GameIsland[]
  outcomes: Record<string, Outcome>
  stars: Record<string, number>
  current: GameIsland | null
  buddyKey: string | null | undefined
  calm: boolean
  onGo: (island: GameIsland) => void
}

// Where each stop sits across the path, in turn, as a share of the width: a
// zigzag. A stop is 14rem wide, so its middle is kept 7rem in from each edge.
const SWAY = [30, 70, 42, 76, 24, 58]
const HALF = '7rem'
const middle = (pct: number) => `clamp(${HALF}, ${pct}%, calc(100% - ${HALF}))`

// Little things that live in each world, scattered at the map's edges.
const SCENERY: Record<GameWorld, string[]> = {
  rainforest: ['🦜', '🍃', '🐒', '🌺', '🦋'],
  reef: ['🐠', '🫧', '🐢', '🐚', '🐟'],
  kampung: ['🪁', '🏮', '🌴', '🐓', '🏮'],
  city: ['🏙️', '🚝', '🌃', '🚕', '🏙️'],
  space: ['⭐', '🛰️', '🌙', '☄️', '✨'],
}

export function TreasureMap({ title, world, islands, outcomes, stars, current, buddyKey, calm, onGo }: MapProps) {
  const cleared = islands.filter((island) => outcomes[island.id]?.reached).length
  return (
    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden" style={backdrop(world)}>
      <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 pb-16 pt-6">
        <Scenery world={world} />
        <header className="relative z-10 rounded-3xl bg-surface/90 px-5 py-4 text-center shadow-sm">
          <h2 className="break-words font-display text-2xl font-semibold">{title}</h2>
          <p className="mt-1 font-semibold text-muted-foreground">
            {current ? `${cleared} of ${islands.length} islands cleared — tap the glowing one!` : `${cleared} of ${islands.length} islands cleared`}
          </p>
        </header>
        <ol aria-label="The map" className="relative z-10 mt-2 flex flex-col">
          {islands.map((island, n) => (
            <li key={island.id} className="flex flex-col">
              {n > 0 && <Trail world={world} from={SWAY[(n - 1) % SWAY.length]} to={SWAY[n % SWAY.length]} />}
              <div className="w-56 max-w-full" style={{ marginLeft: `clamp(0px, calc(${SWAY[n % SWAY.length]}% - ${HALF}), calc(100% - 14rem))` }}>
                <Island
                  number={n + 1}
                  island={island}
                  world={world}
                  state={stateOf(island, outcomes, current)}
                  stars={stars[island.id] ?? 0}
                  buddyKey={buddyKey}
                  calm={calm}
                  onGo={() => onGo(island)}
                />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function stateOf(island: GameIsland, outcomes: Record<string, Outcome>, current: GameIsland | null): State {
  const outcome = outcomes[island.id]
  if (outcome) return outcome.reached ? 'cleared' : 'foggy'
  return current?.id === island.id ? 'next' : 'waiting'
}

function Island({ number, island, world, state, stars, buddyKey, calm, onGo }: {
  number: number; island: GameIsland; world: GameWorld; state: State; stars: number; buddyKey: string | null | undefined; calm: boolean; onGo: () => void
}) {  // fmt: skip
  const hidden = state === 'waiting' || state === 'foggy'
  const said = { cleared: 'cleared', foggy: 'still foggy', next: 'play it now', waiting: 'under the fog' }[state]
  return (
    <div className="flex w-full flex-col items-center gap-2 text-center">
      <div className="relative pt-6">
        <Dressing world={world} hidden={hidden} />
        <motion.button
          type="button"
          onClick={onGo}
          disabled={state !== 'next'}
          aria-label={`Island ${number}, ${said}${hidden ? '' : `: ${island.learn}`}`}
          animate={state === 'next' && !calm ? { scale: [1, 1.06, 1] } : undefined}
          transition={state === 'next' && !calm ? { duration: 1.8, repeat: Infinity } : spring.gentle}
          className={cn(
            'relative z-10 grid size-28 place-items-center border-4 shadow-md sm:size-32',
            LOOKS[world].shape,
            state === 'next' && 'border-sun-400 ring-8 ring-sun-400/40',
            state === 'cleared' && 'border-correct',
            hidden && 'border-border opacity-80 grayscale',
            !hidden && state !== 'next' && state !== 'cleared' && 'border-surface',
          )}
          style={{ background: LOOKS[world].fill(world) }}
        >
          <span className="relative text-5xl leading-none sm:text-6xl" aria-hidden>
            {hidden ? '☁️' : island.icon || LOOKS[world].stop}
          </span>
          <span aria-hidden className="absolute -left-1 -top-1 grid size-9 place-items-center rounded-full border-2 border-surface bg-primary font-display font-bold text-primary-foreground">
            {state === 'cleared' ? <Check weight="bold" className="size-5" /> : number}
          </span>
          {state === 'next' && (
            <span aria-hidden className="absolute -bottom-2 -right-3">
              <BuddyAvatar buddy={buddyKey} size={56} />
            </span>
          )}
        </motion.button>
      </div>
      <Label number={number} island={island} state={state} stars={stars} hidden={hidden} />
    </div>
  )
}

function Label({ number, island, state, stars, hidden }: { number: number; island: GameIsland; state: State; stars: number; hidden: boolean }) {
  return (
    <div className="w-full rounded-2xl bg-surface/90 px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-wide text-primary">
        Island {number} · {PLAY_LABELS[island.play]}
      </p>
      {hidden ? (
        <p className="break-words font-semibold text-muted-foreground">{state === 'foggy' ? 'Still foggy — clear it again later' : 'Under the fog'}</p>
      ) : (
        <p className="break-words font-semibold">{island.learn}</p>
      )}
      {state === 'cleared' && (
        <div className="mt-1 flex justify-center">
          <Stars count={stars} />
        </div>
      )}
      {state === 'next' && (
        <p className="mt-1 flex items-center justify-center gap-1 font-display font-bold text-primary">
          <Play weight="fill" className="size-4" aria-hidden />
          Tap to play
        </p>
      )}
    </div>
  )
}

// --- each world's look -------------------------------------------------------

interface Look {
  /** The stop's outline. */
  shape: string
  /** What fills it, in the world's own colours. */
  fill: (world: GameWorld) => string
  /** Its picture when the island has none of its own. */
  stop: string
}

const LOOKS: Record<GameWorld, Look> = {
  // Sand, a ring of shallow water, then the sea.
  reef: {
    shape: 'rounded-full',
    fill: (w) => `radial-gradient(circle at 50% 45%, ${paint(w, 'ground')} 50%, ${paint(w, 'glow')} 58%, ${paint(w, 'accent')} 72%)`,
    stop: '🏝️',
  },
  // A round canopy of leaves.
  rainforest: {
    shape: 'rounded-[46%_54%_42%_58%/55%_45%_58%_42%]',
    fill: (w) => `radial-gradient(circle at 40% 35%, ${paint(w, 'far')}, ${paint(w, 'mid')} 60%, ${paint(w, 'near')})`,
    stop: '⛺',
  },
  // A wooden house; its roof and stilts are drawn around it.
  kampung: {
    shape: 'rounded-2xl',
    fill: (w) => `linear-gradient(180deg, ${paint(w, 'far')}, ${paint(w, 'mid')})`,
    stop: '🏠',
  },
  // A station on a transit map: a white stop on a coloured line.
  city: {
    shape: 'rounded-full',
    fill: (w) => `radial-gradient(circle, hsl(var(--surface)) 50%, ${paint(w, 'accent')} 52%, ${paint(w, 'accent')} 66%, ${paint(w, 'haze')} 68%)`,
    stop: '🚉',
  },
  // A planet, lit from one side.
  space: {
    shape: 'rounded-full',
    fill: (w) => `radial-gradient(circle at 32% 30%, ${paint(w, 'mid')}, ${paint(w, 'far')} 65%, ${paint(w, 'haze')})`,
    stop: '🪐',
  },
}

/** What a stop wears in its world: a palm, a tent, a roof and stilts, a
 *  station sign, a ring. Faded with it when it is under fog. */
function Dressing({ world, hidden }: { world: GameWorld; hidden: boolean }) {
  const fade = hidden ? 'opacity-50 grayscale' : ''
  if (world === 'kampung') {
    return (
      <>
        <span aria-hidden className={cn('absolute left-1/2 top-0 h-8 w-36 -translate-x-1/2 sm:w-40', fade)} style={{ background: paint(world, 'accent'), clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />
        <span aria-hidden className={cn('absolute -bottom-3 left-6 h-4 w-2 rounded-b', fade)} style={{ background: paint(world, 'ground') }} />
        <span aria-hidden className={cn('absolute -bottom-3 right-6 h-4 w-2 rounded-b', fade)} style={{ background: paint(world, 'ground') }} />
        <span aria-hidden className={cn('absolute -right-6 top-6 z-20 text-2xl', fade)}>🏮</span>
      </>
    )
  }
  if (world === 'space') {
    return <span aria-hidden className={cn('pointer-events-none absolute -inset-x-5 top-[calc(50%+0.75rem)] z-20 h-9 -translate-y-1/2 -rotate-[18deg] rounded-[50%] border-4 opacity-80', fade)} style={{ borderColor: paint(world, 'glow') }} />
  }
  const sign = { reef: '🌴', rainforest: '🌳', city: '🚇' }[world]
  return <span aria-hidden className={cn('absolute -right-4 top-0 z-20 text-3xl', fade)}>{sign}</span>
}

/** The trail from one stop to the next: dots along the line between them,
 *  drawn in the world's way — foam, paw prints, lanterns, a train line, stars. */
function Trail({ world, from, to }: { world: GameWorld; from: number; to: number }) {
  const steps = world === 'city' ? 12 : 6
  return (
    <div aria-hidden className="relative h-16 w-full">
      {Array.from({ length: steps - 1 }, (_, k) => {
        const t = (k + 1) / steps
        const place: CSSProperties = { left: `calc(${middle(from)} * ${1 - t} + ${middle(to)} * ${t})`, top: `${t * 100}%` }
        return <Step key={k} world={world} n={k} style={place} />
      })}
    </div>
  )
}

function Step({ world, n, style }: { world: GameWorld; n: number; style: CSSProperties }) {
  const at = 'absolute -translate-x-1/2 -translate-y-1/2'
  if (world === 'rainforest') return <span className={cn(at, 'text-sm', n % 2 ? 'rotate-12' : '-rotate-12')} style={style}>🐾</span>
  if (world === 'space') return <span className={cn(at, 'text-sm font-bold')} style={{ ...style, color: paint(world, 'glow') }}>✦</span>
  if (world === 'kampung' && n % 2 === 1) return <span className={cn(at, 'text-base')} style={style}>🏮</span>
  const size = world === 'city' ? 'size-3' : 'size-2.5'
  const colour = world === 'reef' ? paint(world, 'glow') : world === 'city' ? paint(world, 'accent') : 'hsl(var(--surface))'
  return <span className={cn(at, size, 'rounded-full')} style={{ ...style, background: colour }} />
}

/** A few of the world's creatures and things at the map's edges, behind the stops. */
function Scenery({ world }: { world: GameWorld }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {SCENERY[world].map((thing, n) => (
        <span key={n} className="absolute text-3xl opacity-60 sm:text-4xl" style={n % 2 ? { top: `${14 + n * 18}%`, right: '0.25rem' } : { top: `${14 + n * 18}%`, left: '0.25rem' }}>
          {thing}
        </span>
      ))}
    </div>
  )
}

function backdrop(world: GameWorld): CSSProperties {
  const sky = `linear-gradient(180deg, ${paint(world, 'sky')}, ${paint(world, 'haze')} 45%, ${paint(world, 'mid')} 80%, ${paint(world, 'ground')})`
  if (world !== 'space') return { background: sky }
  // Space has stars: two scattered layers over the dark.
  const star = (x: number, y: number) => `radial-gradient(circle at ${x}% ${y}%, ${paint(world, 'glow')} 0 1.5px, transparent 2px)`
  return {
    backgroundImage: `${star(20, 30)}, ${star(70, 60)}, ${star(45, 85)}, ${star(85, 15)}, ${sky}`,
    backgroundSize: '140px 140px, 180px 180px, 220px 220px, 160px 160px, 100% 100%',
  }
}
