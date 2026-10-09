/**
 * The treasure map (§26): a game's islands on a winding path across its
 * world, one idea each, in the order they are played. A cleared island shows
 * its stars; the one to play next glows, with the buddy waiting on it; the
 * rest are under fog until the one before is cleared. An island given up on
 * stays foggy — one to clear again.
 */
import { motion } from 'motion/react'
import { Check, Play } from '@phosphor-icons/react'
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

// Where each island sits across the path, in turn: a gentle zigzag.
const SWAY = ['justify-start', 'justify-center', 'justify-end', 'justify-center']

export function TreasureMap({ title, world, islands, outcomes, stars, current, buddyKey, calm, onGo }: MapProps) {
  const cleared = islands.filter((island) => outcomes[island.id]?.reached).length
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: backdrop(world) }}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 pb-16 pt-6">
        <header className="rounded-3xl bg-surface/90 px-5 py-4 text-center shadow-sm">
          <h2 className="break-words font-display text-2xl font-semibold">{title}</h2>
          <p className="mt-1 font-semibold text-muted-foreground">
            {current ? `${cleared} of ${islands.length} islands cleared — tap the glowing one!` : `${cleared} of ${islands.length} islands cleared`}
          </p>
        </header>
        <ol aria-label="The map" className="mt-2 flex flex-col">
          {islands.map((island, n) => (
            <li key={island.id} className={cn('flex flex-col', n > 0 && 'pt-1')}>
              {n > 0 && <Trail />}
              <div className={cn('flex px-2', SWAY[n % SWAY.length])}>
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
    <div className="flex w-56 max-w-full flex-col items-center gap-2 text-center sm:w-64">
      <motion.button
        type="button"
        onClick={onGo}
        disabled={state !== 'next'}
        aria-label={`Island ${number}, ${said}${hidden ? '' : `: ${island.learn}`}`}
        animate={state === 'next' && !calm ? { scale: [1, 1.06, 1] } : undefined}
        transition={state === 'next' && !calm ? { duration: 1.8, repeat: Infinity } : spring.gentle}
        className={cn(
          'relative grid size-28 place-items-center rounded-full border-4 shadow-md sm:size-32',
          state === 'next' && 'border-sun-400 ring-8 ring-sun-400/40',
          state === 'cleared' && 'border-correct',
          hidden && 'border-border opacity-80',
        )}
        style={{ background: `radial-gradient(circle at 50% 40%, ${paint(world, 'near')}, ${paint(world, 'ground')} 75%)` }}
      >
        <span className="text-5xl leading-none sm:text-6xl" aria-hidden>
          {hidden ? '☁️' : island.icon || '🏝️'}
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
    </div>
  )
}

/** The dotted trail from one island to the next. */
function Trail() {
  return (
    <div aria-hidden className="flex justify-center py-1">
      <span className="flex flex-col items-center gap-1.5">
        {[0, 1, 2].map((dot) => (
          <span key={dot} className="size-2.5 rounded-full bg-surface/80" />
        ))}
      </span>
    </div>
  )
}

function backdrop(world: GameWorld): string {
  return `linear-gradient(180deg, ${paint(world, 'sky')}, ${paint(world, 'haze')} 45%, ${paint(world, 'mid')} 80%, ${paint(world, 'ground')})`
}
