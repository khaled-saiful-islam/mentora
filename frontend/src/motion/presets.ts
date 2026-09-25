/**
 * How Mentora moves — one vocabulary, so every screen feels like the same app.
 *
 * Springs rather than durations: a thing that is thrown settles, it does not
 * stop on a timer. `snappy` for controls under a finger, `bouncy` for moments
 * worth celebrating, `gentle` for things arriving on their own.
 */

import type { Transition, Variants } from 'motion/react'

export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 32, mass: 0.7 },
  bouncy: { type: 'spring', stiffness: 380, damping: 14, mass: 0.8 },
  gentle: { type: 'spring', stiffness: 170, damping: 24 },
  lazy: { type: 'spring', stiffness: 90, damping: 18 },
} satisfies Record<string, Transition>

/** A list whose items arrive one after another. Put on the parent. */
export const stagger = (gap = 0.06, delay = 0): Variants => ({
  hidden: {},
  shown: { transition: { staggerChildren: gap, delayChildren: delay } },
})

/** Rise into place: the default arrival for cards and rows. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  shown: { opacity: 1, y: 0, scale: 1, transition: spring.gentle },
}

/** Pop into place: for badges, stars, counters — small things with news. */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.4, rotate: -8 },
  shown: { opacity: 1, scale: 1, rotate: 0, transition: spring.bouncy },
}

/** Pages slide up and fade; leaving is quicker than arriving. */
export const page: Variants = {
  hidden: { opacity: 0, y: 18 },
  shown: { opacity: 1, y: 0, transition: { ...spring.gentle, staggerChildren: 0.05 } },
  gone: { opacity: 0, y: -10, transition: { duration: 0.14 } },
}

/** What a pressable thing does under a finger. Spread onto a motion element. */
export const press = {
  whileHover: { y: -2, transition: spring.snappy },
  whileTap: { y: 2, scale: 0.97, transition: spring.snappy },
} as const

/** A gentle "no" — a wobble, never a harsh shake. */
export const wobble = {
  x: [0, -7, 6, -4, 3, 0],
  transition: { duration: 0.42 },
}
