import { motion } from 'motion/react'
import { ArrowUpRight, Check } from '@phosphor-icons/react'
import { spring, useCalmMotion } from '@/motion'
import { cn } from '@/lib/utils'
import type { LearningKindInfo, LearningKindName } from './api'
import { LOOKS } from './kinds'
import { OPTION_LOOKS } from './options'

/**
 * Quiz and Flashcards, right above the chat box: two living tiles, each
 * playing a few seconds of what it makes.
 */
export function LearnTiles({
  kinds,
  onPick,
  compact = false,
}: {
  kinds: LearningKindInfo[]
  onPick: (kind: LearningKindName) => void
  compact?: boolean
}) {
  if (kinds.length === 0) return null
  const practice = kinds[0]?.purpose === 'practice'
  if (compact) {
    return (
      <div className="mb-2 flex gap-2 px-0.5">
        {kinds.map((kind) => {
          const look = LOOKS[kind.name]
          return (
            <motion.button key={kind.name} type="button" whileTap={{ scale: 0.94 }} onClick={() => onPick(kind.name)} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold', look.soft)}>
              <look.Icon weight="duotone" className="size-4" />
              {look.label}
            </motion.button>
          )
        })}
      </div>
    )
  }
  return (
    <section aria-label={practice ? 'Practise something' : 'Make something to learn'} className="mb-3">
      <h2 className="mb-2 px-1 text-sm font-bold text-muted-foreground">{practice ? 'Practise any topic' : 'Make something to learn'}</h2>
      <div className="grid grid-cols-2 gap-3">
        {kinds.map((kind, index) => (
          <Tile key={kind.name} kind={kind} index={index} onPick={() => onPick(kind.name)} />
        ))}
      </div>
    </section>
  )
}

function Tile({ kind, index, onPick }: { kind: LearningKindInfo; index: number; onPick: () => void }) {
  const look = LOOKS[kind.name]
  return (
    <motion.button
      type="button"
      onClick={onPick}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { ...spring.gentle, delay: index * 0.08 } }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      className={cn('group relative flex h-32 overflow-hidden rounded-[1.75rem] p-4 text-left shadow-press sm:h-36', look.hero)}
      aria-label={`${look.label}: ${look.promise}`}
    >
      <span className="blob -right-8 -top-10 size-32 bg-white/40" aria-hidden />
      <span className="relative z-10 flex flex-col justify-between">
        <span className="inline-flex items-center gap-2">
          <look.Icon weight="duotone" className="size-7" />
          <span className="font-display text-xl font-semibold sm:text-2xl">{look.label}</span>
        </span>
        <span className="max-w-[12rem] text-sm font-semibold leading-snug opacity-90">
          {kind.default_count} {kind.item_noun_plural}, from trusted sources
        </span>
      </span>
      <span className="absolute bottom-3 right-3 sm:right-4" aria-hidden>
        {kind.name === 'quiz' ? <QuizScene /> : <FlashScene />}
      </span>
      <ArrowUpRight weight="bold" className="absolute right-4 top-4 size-5 opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </motion.button>
  )
}

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
