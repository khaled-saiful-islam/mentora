/**
 * Everything a teacher can make from the studio, in one list: the learning
 * kinds (quizzes, flashcards, study guides) and the studio artifacts
 * (posters, slides, websites, apps, games). The create panel and the create
 * menu both read it, so the two can never disagree about what exists.
 *
 * Both halves come from the server's registries; this only adds how each one
 * is shown — a short line, a few examples, its colour, its little scene.
 */
import type { Icon } from '@phosphor-icons/react'
import { colourOf, lookOf } from '@/components/artifacts/kind-look'
import { Scene } from '@/components/make/Scene'
import { showcaseOf, type Makeable } from '@/components/make/showcase'
import type { LearningKindInfo, LearningKindName } from '@/features/learning/api'
import { LOOKS } from '@/features/learning/kinds'
import { LEARN_SCENES } from '@/features/learning/scenes'

export type Group = 'learning' | 'studio'

export interface Creatable {
  key: string
  group: Group
  label: string
  /** One short line on what it is — short enough never to need cutting. */
  blurb: string
  examples: readonly string[]
  Icon: Icon
  /** A CSS colour for the card's `--tile`. */
  colour: string
  /** A bold stage (learning kinds are drawn in white on their gradient). */
  stage?: string
  Scene: () => React.ReactNode
  /** The studio kind behind it, for writing its request into the box. */
  makeable?: Makeable
}

const BLURBS: Record<string, string> = {
  quiz: 'Questions from trusted sources',
  flashcard: 'Cards that flip, word to meaning',
  study_guide: 'A topic taught part by part',
  poster: 'Eye-catching, with real photos',
  slides: 'A talk, slide by slide',
  website: 'One page or many, phone-ready',
  app: 'A tool that remembers',
  games: 'Playable, tested first',
}

const LEARNING_EXAMPLES: Record<LearningKindName, readonly string[]> = {
  quiz: ['Photosynthesis', 'States and capitals of Malaysia', 'Fractions of a whole'],
  flashcard: ['Parts of a flower', 'Planets of the solar system', 'Simpulan bahasa'],
  study_guide: ['The water cycle', 'How volcanoes erupt', 'The history of Melaka'],
}

export function creatables(studio: Makeable[], learning: LearningKindInfo[]): Creatable[] {
  const teach: Creatable[] = learning.map((kind) => {
    const look = LOOKS[kind.name]
    return {
      key: kind.name,
      group: 'learning',
      label: look.label,
      blurb: BLURBS[kind.name] ?? look.promise,
      examples: LEARNING_EXAMPLES[kind.name] ?? [],
      Icon: look.Icon,
      colour: look.colour,
      stage: look.hero,
      Scene: LEARN_SCENES[kind.name] ?? (() => null),
    }
  })
  const design: Creatable[] = studio.map((kind) => ({
    key: kind.name,
    group: 'studio',
    label: kind.label,
    blurb: BLURBS[kind.name] ?? kind.description,
    examples: showcaseOf(kind).examples,
    Icon: lookOf(kind.name).icon,
    colour: colourOf(kind.name),
    Scene: () => <Scene kind={kind.name} />,
    makeable: kind,
  }))
  return [...teach, ...design]
}

export const GROUPS: { key: Group; label: string; hint: string }[] = [
  { key: 'learning', label: 'Learning', hint: 'For your class to play, read and practise' },
  { key: 'studio', label: 'Studio', hint: 'For the wall, the screen and the web' },
]
