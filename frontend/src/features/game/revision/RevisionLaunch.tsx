/**
 * Revise with your class (§26.8): the revision games, started from a game's
 * page in the Library — the Streak Ladder, and Tug-of-War for the class
 * screen, two teams on one projector. Both use the game's pairs and boss
 * questions, and keep nothing. A card of their own beside the game, not
 * buttons among the ones that make it.
 */
import { Ladder, UsersThree, type Icon } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button, Card } from '@/components/ui'
import type { GameItem } from '@/features/learning/api'
import { useCalmMotion } from '@/motion'
import { questionsOf } from './questions'
import { StreakLadder } from './StreakLadder'
import { TugOfWar } from './TugOfWar'

// Fewer questions than this is no ladder to climb, nor a match to pull.
const MIN_QUESTIONS = 4

type Game = 'ladder' | 'tug'

const GAMES: { key: Game; label: string; blurb: string; Icon: Icon }[] = [
  { key: 'tug', label: 'Tug-of-War', blurb: 'Two teams on your class screen: right answers pull the rope.', Icon: UsersThree },
  { key: 'ladder', label: 'Streak Ladder', blurb: 'Climb a rung for every right answer, until the first slip.', Icon: Ladder },
]

export function RevisionCard({ title, items }: { title: string; items: GameItem[] }) {
  const calm = useCalmMotion()
  const [playing, setPlaying] = useState<Game | null>(null)
  const questions = questionsOf(items)
  if (questions.length < MIN_QUESTIONS) return null
  if (playing === 'ladder') return <StreakLadder title={title} questions={questions} calm={calm} onExit={() => setPlaying(null)} />
  if (playing === 'tug') return <TugOfWar title={title} questions={questions} calm={calm} onExit={() => setPlaying(null)} />
  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-semibold">Revise with your class</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {questions.length} questions from this game. Nothing is recorded.
      </p>
      <ul className="mt-3 space-y-2">
        {GAMES.map(({ key, label, blurb, Icon }) => (
          <li key={key} className="rounded-2xl border-2 border-border p-3">
            <p className="flex items-center gap-2 font-display font-semibold">
              <Icon weight="duotone" className="size-5 shrink-0 text-primary" aria-hidden />
              {label}
            </p>
            <p className="mt-0.5 break-words text-sm text-muted-foreground">{blurb}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setPlaying(key)}>
              Start {label}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
