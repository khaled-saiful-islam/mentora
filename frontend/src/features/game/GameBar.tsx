/**
 * Mentora's own bar above a game (§24.3) — outside the game's frame, so it is
 * always the app's words and controls: the way out, the missions with a tick
 * for each one reached, the points, the buddy's hint (it costs a little),
 * sound, full screen, and finishing early. Wraps onto two rows on a phone.
 */
import { motion } from 'motion/react'
import { ArrowsIn, ArrowsOut, Check, Eye, FlagCheckered, Lightbulb, SpeakerHigh, SpeakerSlash, Star, X } from '@phosphor-icons/react'
import { Button, ButtonLink } from '@/components/ui'
import type { GameMission } from '@/features/play/api'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { POINTS } from './points'
import type { Outcome } from './useMissions'

interface GameBarProps {
  title: string
  exitTo: string
  missions: GameMission[]
  outcomes: Record<string, Outcome>
  current: GameMission | null
  points: number
  /** Whether a hint can be asked for now, and what it was if it was. */
  canHint: boolean
  onHint: () => void
  /** "Show me" — offered after two misses at a mission (§25). */
  showMe: (() => void) | null
  sound: boolean
  onSound: () => void
  fullscreen: { available: boolean; on: boolean; toggle: () => void }
  onFinish: (() => void) | null
}

export function GameBar(props: GameBarProps) {
  const { title, exitTo, missions, outcomes, current, points, canHint, onHint, showMe, sound, onSound, fullscreen, onFinish } = props
  return (
    <header className="relative z-20 flex flex-wrap items-center gap-x-3 gap-y-2 border-b-2 border-border bg-surface px-3 py-2">
      <ButtonLink to={exitTo} variant="ghost" size="icon" aria-label="Close the game">
        <X weight="bold" className="size-5" />
      </ButtonLink>
      <h1 className="min-w-0 max-w-full break-words font-display text-lg font-semibold">{title}</h1>
      <ol aria-label="Missions" className="flex flex-wrap items-center gap-1.5">
        {missions.map((mission, n) => (
          <MissionDot key={mission.id} number={n + 1} goal={mission.goal} outcome={outcomes[mission.id]} current={current?.id === mission.id} />
        ))}
      </ol>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {showMe && (
          <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={spring.bouncy}>
            <Button variant="sun" size="sm" onClick={showMe}>
              <Eye weight="bold" className="size-4" />
              Show me
            </Button>
          </motion.span>
        )}
        {canHint && (
          <Button variant="outline" size="sm" onClick={onHint}>
            <Lightbulb weight="fill" className="size-4 text-warning" />
            Hint <span className="text-xs text-muted-foreground">−{POINTS.hint}</span>
          </Button>
        )}
        <motion.span key={points} initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={spring.bouncy} className="inline-flex items-center gap-1.5 rounded-full bg-star-soft px-3 py-1 font-display font-bold tabular-nums" aria-label={`${points} points`}>
          <Star weight="fill" className="size-4 text-warning" aria-hidden />
          {points}
        </motion.span>
        <Button variant="ghost" size="icon" onClick={onSound} aria-label={sound ? 'Sound off' : 'Sound on'} aria-pressed={!sound}>
          {sound ? <SpeakerHigh weight="bold" className="size-5" /> : <SpeakerSlash weight="bold" className="size-5" />}
        </Button>
        {fullscreen.available && (
          <Button variant="ghost" size="icon" onClick={fullscreen.toggle} aria-label={fullscreen.on ? 'Leave full screen' : 'Full screen'}>
            {fullscreen.on ? <ArrowsIn weight="bold" className="size-5" /> : <ArrowsOut weight="bold" className="size-5" />}
          </Button>
        )}
        {onFinish && (
          <Button variant="outline" size="sm" onClick={onFinish}>
            <FlagCheckered weight="bold" className="size-4" />
            Finish
          </Button>
        )}
      </div>
    </header>
  )
}

function MissionDot({ number, goal, outcome, current }: { number: number; goal: string; outcome: Outcome | undefined; current: boolean }) {
  const state = outcome ? (outcome.reached ? 'reached' : 'missed') : current ? 'current' : 'waiting'
  const said = { reached: 'reached', missed: 'not reached', current: 'now', waiting: 'to come' }[state]
  return (
    <li
      title={`Mission ${number}: ${goal}`}
      aria-label={`Mission ${number}, ${said}: ${goal}`}
      className={cn(
        'grid size-8 place-items-center rounded-full border-2 font-display text-sm font-bold',
        state === 'reached' && 'border-correct bg-correct text-white',
        state === 'missed' && 'border-border bg-muted text-muted-foreground',
        state === 'current' && 'border-primary bg-selected text-primary',
        state === 'waiting' && 'border-border text-muted-foreground',
      )}
    >
      {state === 'reached' ? <Check weight="bold" className="size-4" /> : number}
    </li>
  )
}
