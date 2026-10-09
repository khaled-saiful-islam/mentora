/**
 * A round of a game (§26): one island's play, in one of Mentora's own
 * templates. The server writes and checks the content (`app/learning/game.py`);
 * a round only shows it and answers every move at once — right, or wrong and
 * why — until every piece is in its place.
 */
import type { Sound } from '@/lib/sound'

/** The templates a round can be played in. */
export type Play = 'sort' | 'order' | 'match' | 'lab' | 'mistake' | 'case' | 'escape' | 'boss'

/** Who it is for (§26.3): Year 1–3, Year 4–6, or Form 1 and up. */
export type Band = 'early' | 'middle' | 'secondary'

export interface Basket {
  id: string
  label: string
  /** An emoji, or empty. */
  icon: string
}

export interface SortCard {
  id: string
  text: string
  icon: string
  /** The basket it belongs in. */
  basket: string
  /** Why it belongs there — said when it is put in the wrong one. */
  why: string
}

export interface SortContent {
  baskets: Basket[]
  cards: SortCard[]
}

export interface Step {
  id: string
  text: string
  icon: string
  /** Why it comes here — said when it is put too early. */
  why: string
}

export interface OrderContent {
  /** In the right order; a round shuffles them itself. */
  steps: Step[]
}

export interface Pair {
  id: string
  left: string
  right: string
  /** Why they go together — said when one is joined to the wrong partner. */
  why: string
}

export interface MatchContent {
  pairs: Pair[]
}

/** A slider in The Lab. */
export interface LabControl {
  id: string
  label: string
  icon: string
  unit: string
  min: number
  max: number
  step: number
  start: number
}

/** A goal in The Lab: bring the output between `low` and `high`. */
export interface LabGoal {
  id: string
  text: string
  low: number
  high: number
  /** Said when the child lets go of a slider and the output is not there yet. */
  why: string
  /** Slider values that reach it, found by the server: what Show me plays. */
  solution: Record<string, number>
}

export interface LabContent {
  controls: LabControl[]
  /** What the formula gives, and the range its meter shows. */
  output: { label: string; icon: string; unit: string; min: number; max: number }
  /** In the controls' ids: + - * / ^ ( ), numbers, `pi`, and sin cos tan (in
   *  degrees) sqrt abs min max. Evaluated by `formula.ts` — never `eval`. */
  formula: string
  goals: LabGoal[]
}

/** A line of a worked answer or a paragraph in Spot the Mistake. */
export interface MistakeLine {
  id: string
  text: string
  wrong: boolean
  /** For a wrong line: its right version, and wrong ones offered beside it. */
  fix: string
  decoys: string[]
  /** Why it is wrong — or, for a right line tapped, why it is right. */
  why: string
}

export interface MistakeContent {
  /** What the lines are: "Ali's working", "Siti's paragraph". */
  title: string
  lines: MistakeLine[]
}

export interface CaseClue {
  id: string
  title: string
  icon: string
  text: string
  /** A small table, first row the headings; empty for none. */
  rows: string[][]
  /** What it shows — said when it is picked and does not prove the answer. */
  why: string
}

export interface CaseSuspect {
  id: string
  name: string
  icon: string
  claim: string
  /** Why it is the answer, or why it is not. */
  why: string
}

export interface CaseContent {
  question: string
  clues: CaseClue[]
  suspects: CaseSuspect[]
  /** The suspect that answers the question, and the clue that proves it. */
  answer: string
  key: string
}

export interface EscapeDoor {
  id: string
  puzzle: string
  icon: string
  /** How the code is entered: a keypad, letter tiles, or one of `options`. */
  kind: 'number' | 'word' | 'choice'
  answer: string
  options: string[]
  why: string
}

export interface EscapeContent {
  doors: EscapeDoor[]
}

export interface BossQuestion {
  id: string
  ask: string
  options: string[]
  /** The right option's index. */
  answer: number
  why: string
}

export interface BossContent {
  name: string
  icon: string
  questions: BossQuestion[]
}

export interface Contents {
  sort: SortContent
  order: OrderContent
  match: MatchContent
  lab: LabContent
  mistake: MistakeContent
  case: CaseContent
  escape: EscapeContent
  boss: BossContent
}

/** One move the child made: which piece, and whether it was right. A
 *  wrong move is a slip: counted for stars, and named in the teacher's
 *  results by the piece's id (a card, a step, a pair, a goal, a line, a
 *  suspect or clue, a door, a question). */
export interface Move {
  piece: string
  right: boolean
}

export interface RoundProps<C> {
  content: C
  band: Band
  /** No shaking, flying or fast motion. */
  calm: boolean
  /** The buddy says it (and it is read aloud): the why of a wrong move. */
  say: (text: string) => void
  sound: (name: Sound) => void
  /** Goes up by one each time the child presses Show me: the round then
   *  plays one right move itself, slowly enough to watch. */
  showMe: number
  /** Every move, right or wrong; a wrong one is a slip. */
  onMove: (move: Move) => void
  /** Every piece is in its place. Called once. */
  onDone: () => void
}

/** The band for a set's year, e.g. `year_2` → early. */
export function bandOf(gradeLevel: string | null | undefined): Band {
  const year = /^year_(\d)$/.exec(gradeLevel ?? '')
  if (year) return Number(year[1]) <= 3 ? 'early' : 'middle'
  return gradeLevel ? 'secondary' : 'middle'
}
