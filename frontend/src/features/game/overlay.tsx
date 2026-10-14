/**
 * Which card Mentora shows over a game, and what "Read it to me" reads on it
 * (§25, §26): the opening; an island's Learn it before the child plays it;
 * What you discovered once it is cleared; the ending. At most one at a time —
 * and none while the child is on the map or playing a round.
 */
import type { StoryLine } from '@/features/learning/api'
import type { Attempt, GameIsland } from '@/features/play/api'
import type { Spoken } from '@/features/play/backend'
import type { Line, PlayVoice } from '@/features/play/usePlayVoice'
import type { GameWorld } from '@/features/learning/api'
import { Discovery, Finale, LearnCard, told, type Cast, type Telling } from './cards'
import { MissionBriefing } from './mission/Briefing'
import type { Sting } from './mission/score'
import { isStart, Opening } from './openings'
import { PLAY_LABELS } from './rounds'
import { HowToFolded, HowToPlay } from './rounds/howto'
import type { Islands, Outcome } from './useIslands'

export type Phase = 'story' | 'map' | 'learn' | 'play' | 'end'

export interface Shown {
  island: GameIsland
  outcome: Outcome
}

/** What to tell aloud as a card appears (§28.3.2): its lines, and the sting
 *  that goes before them. */
export interface Tell {
  key: string
  lines: Line[]
  sting: Sting | null
}

export interface Overlay {
  node: React.ReactNode
  tell: Tell | null
}

interface OverlayArgs {
  /** The mission briefing has been started: the story may show. */
  briefed: boolean
  /** The opening's words are on screen: they may be told. */
  openingShown: boolean
  /** The player's first name, for "Agent Aina". */
  agent: string
  onBegin: () => void
  onShown: () => void
  attempt: Attempt
  run: Islands
  cast: Cast
  phase: Phase
  shown: Shown | null
  /** The island the child went to on the map: its Learn it, then its round. */
  active: GameIsland | null
  world: GameWorld
  calm: boolean
  voice: PlayVoice
  practice: boolean
  onStart: () => void
  onPlay: () => void
  onNext: () => void
  onFinished: () => void
}

export function overlayFor(args: OverlayArgs): Overlay {
  const { phase, shown, active } = args
  if (phase === 'story') return opening(args)
  if (shown) return discovery(args, shown)
  if (phase === 'learn' && active) return learning(args, active)
  if (phase === 'end') return ending(args)
  return { node: null, tell: null }
}

function opening(args: OverlayArgs): Overlay {
  const { attempt, run, cast, voice, world, calm, onStart, briefed, openingShown, agent, onBegin, onShown } = args
  const extras = attempt.extras
  const story = extras.story
  const title = extras.title || attempt.title
  if (!briefed) {
    return {
      node: <MissionBriefing title={title} count={run.islands.length} agent={agent} world={world} calm={calm} onBegin={onBegin} />,
      tell: null,
    }
  }
  const lines = toldLines([...piece('hook', story?.hook), ...panel('opening', story?.opening), ...piece('goal', story?.goal)], cast.buddyName)
  return {
    node: (
      <Opening
        start={isStart(extras.start) ? extras.start : 'comic'}
        world={world}
        calm={calm}
        title={title}
        hook={told(story?.hook, cast.buddyName)}
        goal={told(story?.goal, cast.buddyName)}
        lines={story?.opening ?? []}
        cast={cast}
        count={run.islands.length}
        telling={tellingOf(voice, 'opening', lines)}
        onStart={onStart}
        onShown={onShown}
      />
    ),
    // The opening's own sting plays as it appears (GameHost); the words after.
    tell: openingShown ? { key: 'opening', lines, sting: null } : null,
  }
}

function discovery({ attempt, run, cast, voice, onNext }: OverlayArgs, { island, outcome }: Shown): Overlay {
  const after = attempt.extras.beats?.[island.id]?.after ?? []
  const key = `why-${island.id}`
  const lines = toldLines(
    [
      ...(outcome.explanation ? [{ spoken: { item: island.id, part: 'explanation' } as Spoken, text: outcome.explanation }] : []),
      ...beatLines(island.id, 'after', after),
    ],
    cast.buddyName,
  )
  return {
    node: (
      <Discovery
        number={run.islands.indexOf(island) + 1}
        learn={island.learn}
        reached={outcome.reached}
        stars={run.stars[island.id] ?? 0}
        explanation={outcome.explanation}
        lines={after}
        cast={cast}
        last={run.islands.every((m) => run.outcomes[m.id])}
        telling={tellingOf(voice, key, lines)}
        onNext={onNext}
      />
    ),
    tell: { key, lines, sting: null },
  }
}

function learning({ attempt, run, cast, voice, practice, calm, onPlay }: OverlayArgs, island: GameIsland): Overlay {
  const before = practice ? [] : attempt.extras.beats?.[island.id]?.before ?? []
  // Shown open the first time a template comes up in the game; folded after.
  const first = run.islands.find((other) => other.play === island.play) === island
  const how = { play: island.play, language: attempt.language, calm }
  const key = `learn-${island.id}`
  const lines = toldLines(
    [
      ...beatLines(island.id, 'before', before),
      ...(island.learn ? [{ spoken: { item: island.id, part: 'learn' } as Spoken, text: island.learn }] : []),
      ...(island.task ? [{ spoken: { item: island.id, part: 'task' } as Spoken, text: island.task }] : []),
    ],
    cast.buddyName,
  )
  return {
    node: (
      <LearnCard
        number={run.islands.indexOf(island) + 1}
        total={run.islands.length}
        icon={island.icon}
        learn={island.learn}
        task={island.task}
        play={PLAY_LABELS[island.play]}
        lines={before}
        cast={cast}
        howTo={first ? <HowToPlay {...how} /> : <HowToFolded {...how} />}
        telling={tellingOf(voice, key, lines)}
        onTry={onPlay}
      />
    ),
    tell: { key, lines, sting: 'island' },
  }
}

function ending({ attempt, run, cast, voice, practice, onFinished }: OverlayArgs): Overlay {
  const story = attempt.extras.story
  const reached = run.islands.filter((m) => run.outcomes[m.id]?.reached).length
  const stars = Object.values(run.stars).reduce((sum, n) => sum + n, 0)
  const lines = toldLines([...piece('win', story?.win), ...(practice ? [] : panel('ending', story?.ending))], cast.buddyName)
  return {
    node: (
      <Finale
        win={told(story?.win, cast.buddyName)}
        lines={practice ? [] : story?.ending ?? []}
        cast={cast}
        reached={reached}
        total={run.islands.length}
        stars={stars}
        points={run.points}
        telling={tellingOf(voice, 'ending', lines)}
        doneLabel={practice ? 'Back to my score' : 'See my points'}
        onDone={onFinished}
      />
    ),
    tell: { key: 'ending', lines, sting: 'win' },
  }
}

/** The lines as they are shown and said: the player's own buddy named. */
function toldLines(lines: Line[], buddyName: string): Line[] {
  return lines.map((l) => ({ ...l, text: told(l.text, buddyName) }))
}

/** "Read it to me" on a card: start or stop its lines. */
function tellingOf(voice: PlayVoice, key: string, lines: Line[]): Telling {
  return {
    reading: voice.reading === key,
    readable: voice.supported && lines.length > 0,
    toggle: () => (voice.reading === key ? voice.stop() : voice.read(key, lines)),
  }
}

function piece(item: 'hook' | 'goal' | 'win', text: string | undefined): Line[] {
  return text ? [{ spoken: { item, part: 'story' }, text }] : []
}

function panel(item: 'opening' | 'ending', lines: StoryLine[] | undefined): Line[] {
  return (lines ?? []).map((line, n) => ({ spoken: { item, part: 'story', n }, text: line.says }))
}

function beatLines(island: string, part: 'before' | 'after', lines: StoryLine[]): Line[] {
  return lines.map((line, n) => ({ spoken: { item: island, part, n }, text: line.says }))
}
