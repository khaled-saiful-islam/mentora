/**
 * Which card Mentora shows over a game, and what "Read it to me" reads on it
 * (§25): the opening; a mission's Learn it before the child plays it; What
 * you discovered once it is reached; the ending. At most one at a time — and
 * none while the child is playing.
 */
import type { StoryLine } from '@/features/learning/api'
import type { Attempt, GameMission } from '@/features/play/api'
import type { Spoken } from '@/features/play/backend'
import type { Line, PlayVoice } from '@/features/play/usePlayVoice'
import { Discovery, Finale, LearnCard, StoryCard, told, type Cast, type Telling } from './cards'
import type { Missions, Outcome } from './useMissions'

export interface Shown {
  mission: GameMission
  outcome: Outcome
}

interface OverlayArgs {
  attempt: Attempt
  run: Missions
  cast: Cast
  phase: 'story' | 'play' | 'end'
  shown: Shown | null
  /** The current mission has not been learnt yet: its Learn it comes first. */
  learning: boolean
  voice: PlayVoice
  practice: boolean
  onStart: () => void
  onLearnt: (id: string) => void
  onNext: () => void
  onFinished: () => void
}

export function overlayFor(args: OverlayArgs): React.ReactNode {
  const { attempt, run, cast, phase, shown, learning, practice } = args
  const extras = attempt.extras
  const story = extras.story
  const beats = extras.beats ?? {}
  const telling = tellingFrom(args.voice, cast.buddyName)
  const total = run.missions.length
  if (phase === 'story') {
    return (
      <StoryCard
        title={extras.title || attempt.title}
        hook={told(story?.hook, cast.buddyName)}
        goal={told(story?.goal, cast.buddyName)}
        lines={story?.opening ?? []}
        cast={cast}
        count={total}
        telling={telling('opening', [...piece('hook', story?.hook), ...panel('opening', story?.opening), ...piece('goal', story?.goal)])}
        onStart={args.onStart}
      />
    )
  }
  if (shown) {
    const after = beats[shown.mission.id]?.after ?? []
    return (
      <Discovery
        number={run.missions.indexOf(shown.mission) + 1}
        goal={shown.mission.goal}
        reached={shown.outcome.reached}
        stars={run.stars[shown.mission.id] ?? 0}
        explanation={shown.outcome.explanation}
        lines={after}
        cast={cast}
        last={run.missions.every((m) => run.outcomes[m.id])}
        telling={telling(`why-${shown.mission.id}`, [
          ...(shown.outcome.explanation ? [{ spoken: { item: shown.mission.id, part: 'explanation' } as Spoken, text: shown.outcome.explanation }] : []),
          ...beatLines(shown.mission.id, 'after', after),
        ])}
        onNext={args.onNext}
      />
    )
  }
  const current = run.current
  if (learning && current) {
    const before = beats[current.id]?.before ?? []
    return (
      <LearnCard
        number={run.missions.indexOf(current) + 1}
        total={total}
        icon={current.icon}
        learn={current.learn}
        guide={current.guide}
        lines={practice ? [] : before}
        cast={cast}
        telling={telling(`learn-${current.id}`, [
          ...(practice ? [] : beatLines(current.id, 'before', before)),
          ...(current.learn ? [{ spoken: { item: current.id, part: 'learn' } as Spoken, text: current.learn }] : []),
          ...(current.guide ? [{ spoken: { item: current.id, part: 'guide' } as Spoken, text: current.guide }] : []),
        ])}
        onTry={() => args.onLearnt(current.id)}
      />
    )
  }
  if (phase === 'end') {
    const reached = run.missions.filter((m) => run.outcomes[m.id]?.reached).length
    const stars = Object.values(run.stars).reduce((sum, n) => sum + n, 0)
    return (
      <Finale
        win={told(story?.win, cast.buddyName)}
        lines={practice ? [] : story?.ending ?? []}
        cast={cast}
        reached={reached}
        total={total}
        stars={stars}
        points={run.points}
        telling={telling('ending', [...piece('win', story?.win), ...(practice ? [] : panel('ending', story?.ending))])}
        doneLabel={practice ? 'Back to my score' : 'See my points'}
        onDone={args.onFinished}
      />
    )
  }
  return null
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

function beatLines(mission: string, part: 'before' | 'after', lines: StoryLine[]): Line[] {
  return lines.map((line, n) => ({ spoken: { item: mission, part, n }, text: line.says }))
}
