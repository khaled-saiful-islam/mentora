/**
 * A few seconds of what each learning kind makes, playing in a small space:
 * options lighting up with a tick, a card flipping, a book turning its pages.
 * Drawn on the kind's own gradient, in white.
 */
import { motion } from 'motion/react'
import { Check } from '@phosphor-icons/react'
import { useCalmMotion } from '@/motion'
import { cn } from '@/lib/utils'
import type { LearningKindName } from './api'
import { OPTION_LOOKS } from './options'

/** Four options light up in turn; one gets the tick. */
function QuizScene() {
  const calm = useCalmMotion()
  return (
    <span className="grid grid-cols-2 gap-1">
      {OPTION_LOOKS.map((option, i) => (
        <motion.span
          key={option.letter}
          className={cn('relative grid h-5 w-9 place-items-center rounded-md sm:h-6 sm:w-11', option.tile)}
          animate={calm ? undefined : { opacity: [0.55, 1, 0.55], scale: [1, i === 2 ? 1.12 : 1.04, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }}
        >
          <option.Shape weight="fill" className="size-2.5 sm:size-3" />
          {i === 2 && (
            <motion.span
              className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-white text-mint-700 shadow"
              animate={calm ? undefined : { scale: [0, 0, 1.2, 1, 1, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.4, 0.55, 0.65, 0.9, 1] }}
            >
              <Check weight="bold" className="size-2.5" />
            </motion.span>
          )}
        </motion.span>
      ))}
    </span>
  )
}

/** A card that flips, over and over: ? then ! */
function FlashScene() {
  const calm = useCalmMotion()
  return (
    <span className="relative block h-14 w-12 [perspective:400px] sm:h-16 sm:w-14">
      <motion.span
        className="absolute inset-0 [transform-style:preserve-3d]"
        animate={calm ? undefined : { rotateY: [0, 0, 180, 180, 360] }}
        transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.35, 0.5, 0.85, 1], ease: 'easeInOut' }}
      >
        <span className="absolute inset-0 grid place-items-center rounded-lg bg-white font-display text-2xl font-semibold text-kind-flashcard shadow [backface-visibility:hidden]">?</span>
        <span className="absolute inset-0 grid place-items-center rounded-lg bg-sun-300 font-display text-2xl font-semibold text-grape-900 shadow [backface-visibility:hidden] [transform:rotateY(180deg)]">!</span>
      </motion.span>
    </span>
  )
}

/** A little book, its pages turning one after another. */
function GuideScene() {
  const calm = useCalmMotion()
  return (
    <span className="relative flex h-14 w-20 items-end justify-center [perspective:500px] sm:h-16 sm:w-24">
      <span className="absolute bottom-0 left-1 h-12 w-9 rounded-l-md bg-white/90 shadow sm:h-14 sm:w-10" />
      <span className="absolute bottom-0 right-1 h-12 w-9 rounded-r-md bg-white shadow sm:h-14 sm:w-10">
        <span className="absolute inset-x-1.5 top-2 space-y-1">
          <span className="block h-1 rounded bg-kind-study-guide-vivid/50" />
          <span className="block h-1 w-3/4 rounded bg-kind-study-guide-vivid/30" />
          <span className="block h-3 rounded-sm bg-sun-300/80" />
        </span>
      </span>
      {[0, 1].map((page) => (
        <motion.span
          key={page}
          className="absolute bottom-0 left-1/2 h-12 w-9 origin-left rounded-r-md bg-sky-100 shadow-sm [backface-visibility:hidden] sm:h-14 sm:w-10"
          animate={calm ? undefined : { rotateY: [0, 0, -180, -180] }}
          transition={{ duration: 3.4, repeat: Infinity, delay: page * 0.5, times: [0, 0.3, 0.6, 1], ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

export const LEARN_SCENES: Record<LearningKindName, () => React.ReactNode> = {
  quiz: QuizScene,
  flashcard: FlashScene,
  study_guide: GuideScene,
}
