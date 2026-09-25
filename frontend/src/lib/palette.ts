/**
 * The colours a class or a group can wear, as Tailwind classes.
 *
 * Written out in full because Tailwind finds classes by reading source: a
 * class built at runtime (`from-${theme}`) would never be generated.
 */

export type ThemeKey = 'grape' | 'sun' | 'mint' | 'coral' | 'sky' | 'tangerine' | 'lagoon' | 'orchid'

export interface ThemeLook {
  label: string
  /** A bold gradient for heroes and card tops. */
  hero: string
  /** Text that reads on `hero`. */
  onHero: string
  /** A soft tint for chips and backgrounds. */
  soft: string
  /** A solid dot or swatch. */
  dot: string
}

export const THEMES: Record<ThemeKey, ThemeLook> = {
  grape: {
    label: 'Grape',
    hero: 'bg-gradient-to-br from-grape-400 to-grape-700',
    onHero: 'text-white',
    soft: 'bg-grape-100 text-grape-800 dark:bg-grape-800/40 dark:text-grape-100',
    dot: 'bg-grape-500',
  },
  sun: {
    label: 'Sunshine',
    hero: 'bg-gradient-to-br from-sun-300 to-sun-600',
    onHero: 'text-grape-900',
    soft: 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300',
    dot: 'bg-sun-400',
  },
  mint: {
    label: 'Mint',
    hero: 'bg-gradient-to-br from-mint-400 to-mint-700',
    onHero: 'text-white',
    soft: 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100',
    dot: 'bg-mint-400',
  },
  coral: {
    label: 'Coral',
    hero: 'bg-gradient-to-br from-coral-400 to-coral-700',
    onHero: 'text-white',
    soft: 'bg-coral-100 text-coral-700 dark:bg-coral-700/30 dark:text-coral-100',
    dot: 'bg-coral-400',
  },
  sky: {
    label: 'Sky',
    hero: 'bg-gradient-to-br from-sky-400 to-sky-700',
    onHero: 'text-white',
    soft: 'bg-sky-100 text-sky-700 dark:bg-sky-700/30 dark:text-sky-100',
    dot: 'bg-sky-400',
  },
  tangerine: {
    label: 'Tangerine',
    hero: 'bg-gradient-to-br from-kind-quiz-vivid to-kind-quiz',
    onHero: 'text-white',
    soft: 'bg-kind-quiz-vivid/15 text-kind-quiz',
    dot: 'bg-kind-quiz-vivid',
  },
  lagoon: {
    label: 'Lagoon',
    hero: 'bg-gradient-to-br from-kind-flashcard-vivid to-kind-flashcard',
    onHero: 'text-white',
    soft: 'bg-kind-flashcard-vivid/15 text-kind-flashcard',
    dot: 'bg-kind-flashcard-vivid',
  },
  orchid: {
    label: 'Orchid',
    hero: 'bg-gradient-to-br from-kind-games-vivid to-kind-games',
    onHero: 'text-white',
    soft: 'bg-kind-games-vivid/15 text-kind-games',
    dot: 'bg-kind-games-vivid',
  },
}

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[]

export function lookOf(key: string): ThemeLook {
  return THEMES[(key in THEMES ? key : 'grape') as ThemeKey]
}
