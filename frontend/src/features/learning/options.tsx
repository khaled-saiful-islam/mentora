/**
 * The four answer options: each has a letter, a colour AND a shape, so no one
 * needs to tell colours apart to tell options apart.
 */
import { Circle, Diamond, Square, Triangle, type Icon } from '@phosphor-icons/react'

export interface OptionLook {
  letter: string
  Shape: Icon
  tile: string
  soft: string
}

export const OPTION_LOOKS: OptionLook[] = [
  { letter: 'A', Shape: Triangle, tile: 'bg-coral-400 text-white', soft: 'bg-coral-100 text-coral-700 dark:bg-coral-700/30 dark:text-coral-100' },
  { letter: 'B', Shape: Diamond, tile: 'bg-sky-400 text-white', soft: 'bg-sky-100 text-sky-700 dark:bg-sky-700/30 dark:text-sky-100' },
  { letter: 'C', Shape: Circle, tile: 'bg-sun-400 text-grape-900', soft: 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300' },
  { letter: 'D', Shape: Square, tile: 'bg-mint-400 text-grape-900', soft: 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100' },
]
