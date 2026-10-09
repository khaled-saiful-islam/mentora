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
import { Discovery, Finale, LearnCard, StoryCard, told, type Cast, type Telling } from './cards'
import { PLAY_LABELS } from './rounds'
import type { Islands, Outcome } from './useIslands'

export type Phase = 'story' | 'map' | 'learn' | 'play' | 'end'

export interface Shown {
  island: GameIsland
  outcome: Outcome
}

interface OverlayArgs {
  attempt: Attempt
  run: Islands
  cast: Cast
  phase: Phase
  shown: Shown | null
  /** The island the child went to on the map: its Learn it, then its round. */
  active: GameIsland | null
  voice: PlayVoice
  practice: boolean
  onStart: () => void
  onPlay: () => void
  onNext: () => void
  onFinished: () => void
}

export function overlayFor(args: OverlayArgs): React.ReactNode {
  const { phase, shown, active } = args
  if (phase === 'story') return opening(args)
  if (shown) return discovery(args, shown)
  if (phase === 'learn' && active) return learning(args, active)
  if (phase === 'end') return ending(args)
  return null
}

function opening({ attempt, run, cast, voice, onStart }: OverlayArgs) {
  const extras = attempt.extras
  const story = extras.story
  const telling = tellingFrom(voice, cast.buddyName)
  return (
    <StoryCard
      title={extras.title || attempt.title}
      hook={told(story?.hook, cast.buddyName)}
      goal={told(story?.goal, cast.buddyName)}
      lines={story?.opening ?? []}
      cast={cast}
      count={run.islands.length}
      telling={telling('opening', [...piece('hook', story?.hook), ...panel('opening', story?.opening), ...piece('goal', story?.goal)])}
      onStart={onStart}
    />
  )
}

function discovery({ attempt, run, cast, voice, onNext }: OverlayArgs, { island, outcome }: Shown) {
  const after = attempt.extras.beats?.[island.id]?.after ?? []
  const telling = tellingFrom(voice, cast.buddyName)
  return (
    <Discovery
      number={run.islands.indexOf(island) + 1}
      learn={island.learn}
      reached={outcome.reached}
      stars={run.stars[island.id] ?? 0}
      explanation={outcome.explanation}
      lines={after}
      cast={cast}
      last={run.islands.every((m) => run.outcomes[m.id])}
      telling={telling(`why-${island.id}`, [
        ...(outcome.explanation ? [{ spoken: { item: island.id, part: 'explanation' } as Spoken, text: outcome.explanation }] : []),
        ...beatLines(island.id, 'after', after),
      ])}
      onNext={onNext}
    />
  )
}

function learning({ attempt, run, cast, voice, practice, onPlay }: OverlayArgs, island: GameIsland) {
  const before = practice ? [] : attempt.extras.beats?.[island.id]?.before ?? []
  const telling = tellingFrom(voice, cast.buddyName)
  return (
    <LearnCard
      number={run.islands.indexOf(island) + 1}
      total={run.islands.length}
      icon={island.icon}
      learn={island.learn}
      task={island.task}
      play={PLAY_LABELS[island.play]}
      lines={before}
      cast={cast}
      telling={telling(`learn-${island.id}`, [
        ...beatLines(island.id, 'before', before),
        ...(island.learn ? [{ spoken: { item: island.id, part: 'learn' } as Spoken, text: island.learn }] : []),
        ...(island.task ? [{ spoken: { item: island.id, part: 'task' } as Spoken, text: island.task }] : []),
      ])}
      onTry={onPlay}
    />
  )
}

function ending({ attempt, run, cast, voice, practice, onFinished }: OverlayArgs) {
  const story = attempt.extras.story
  const telling = tellingFrom(voice, cast.buddyName)
  const reached = run.islands.filter((m) => run.outcomes[m.id]?.reached).length
  const stars = Object.values(run.stars).reduce((sum, n) => sum + n, 0)
  return (
    <Finale
      win={told(story?.win, cast.buddyName)}
      lines={practice ? [] : story?.ending ?? []}
      cast={cast}
      reached={reached}
      total={run.islands.length}
      stars={stars}
      points={run.points}
      telling={telling('ending', [...piece('win', story?.win), ...(practice ? [] : panel('ending', story?.ending))])}
      doneLabel={practice ? 'Back to my score' : 'See my points'}
      onDone={onFinished}
    />
  )
}

function tellingFrom(voice: PlayVoice, buddyName: string) {
  return (key: string, lines: Line[]): Telling => ({
    reading: voice.reading === key,
    readable: voice.supported && lines.length > 0,
    toggle: () => (voice.reading === key ? voice.stop() : voice.read(key, lines.map((l) => ({ ...l, text: told(l.text, buddyName) })))),
  })
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
