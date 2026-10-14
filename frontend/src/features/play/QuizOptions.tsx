/**
 * A quiz question's four answer tiles, each with its own shape and colour so
 * a child can find "the blue diamond" before they can read it. The quiz
 * player and a second chance's question like it (§28.3.7) both use them.
 */
import { motion } from 'motion/react'
import { Check, Circle, Diamond, Square, Triangle, X } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { spring, wobble } from '@/motion'
import type { Played, QuizItem } from './api'
import type { PlayLook } from './level'
import { SparkleBurst } from './PlayFun'

interface Marker {
  Icon: Icon
  tile: string
  key: string
  /** The whole tile in the marker's colour, for the youngest. */
  bright: string
  /** A bold edge in the marker's colour, for Year 4–6. */
  accent: string
  /** What it is called when read aloud: "the triangle". */
  name: string
}

// Shape, colour and key for each position — the same everywhere. The tutor's
// voice names the shapes the same way (`SHAPES` in `services/read_aloud.py`).
export const MARKERS: Marker[] = [
  { Icon: Triangle, tile: 'bg-coral-400', key: '1', bright: 'border-coral-400 bg-coral-100 dark:bg-coral-700/25', accent: 'border-l-coral-400', name: 'Triangle' },
  { Icon: Diamond, tile: 'bg-sky-400', key: '2', bright: 'border-sky-400 bg-sky-100 dark:bg-sky-700/25', accent: 'border-l-sky-400', name: 'Diamond' },
  { Icon: Circle, tile: 'bg-sun-400', key: '3', bright: 'border-sun-400 bg-sun-100 dark:bg-sun-600/20', accent: 'border-l-sun-400', name: 'Circle' },
  { Icon: Square, tile: 'bg-mint-400', key: '4', bright: 'border-mint-400 bg-mint-100 dark:bg-mint-700/25', accent: 'border-l-mint-400', name: 'Square' },
]

// The youngest get tiles that tumble in; everyone else, a quick rise.
const ENTER = {
  plain: { hidden: { opacity: 0, y: 16, scale: 0.96 }, shown: { opacity: 1, y: 0, scale: 1 } },
  bright: { hidden: { opacity: 0, y: 28, scale: 0.8, rotate: -4 }, shown: { opacity: 1, y: 0, scale: 1, rotate: 0, transition: spring.bouncy } },
  // Year 4–6: slid in from the side, one after another, like cards dealt.
  quest: { hidden: { opacity: 0, x: -24 }, shown: { opacity: 1, x: 0, transition: spring.snappy } },
}

export function Options({
  item,
  answer,
  instant,
  disabled,
  look,
  onChoose,
}: {
  item: QuizItem
  answer: Played | undefined
  instant: boolean
  disabled: boolean
  look: PlayLook
  onChoose: (choice: number) => void
}) {
  const right = answer?.reveal?.answer
  return (
    <motion.ul
      className="mt-6 grid gap-3 sm:grid-cols-2"
      initial="hidden"
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: look.tiles === 'bright' ? 0.1 : 0.06, delayChildren: 0.1 } } }}
    >
      {item.options.map((option, i) => {
        const chosen = answer?.choice === i
        const state = !answer
          ? 'open'
          : !instant
            ? chosen
              ? 'locked'
              : 'dim'
            : chosen && answer.correct
              ? 'right'
              : chosen
                ? 'wrong'
                : right === i
                  ? 'reveal'
                  : 'dim'
        return (
          <motion.li key={i} variants={ENTER[look.tiles]}>
            <OptionTile marker={MARKERS[i % MARKERS.length]} text={option} state={state} look={look} position={i} disabled={disabled || Boolean(answer)} onClick={() => onChoose(i)} />
          </motion.li>
        )
      })}
    </motion.ul>
  )
}

type TileState = 'open' | 'locked' | 'right' | 'wrong' | 'reveal' | 'dim'

const TILE: Record<TileState, string> = {
  open: 'border-border bg-surface hover:border-hover-border hover:shadow-lg',
  locked: 'border-primary bg-selected ring-4 ring-primary/25',
  right: 'border-correct bg-correct-soft ring-4 ring-correct/30',
  wrong: 'border-wrong bg-wrong-soft',
  reveal: 'border-correct bg-surface ring-4 ring-correct/30',
  dim: 'border-border bg-surface opacity-55',
}

function OptionTile({
  marker,
  text,
  state,
  look,
  position,
  disabled,
  onClick,
}: {
  marker: Marker
  text: string
  state: TileState
  look: PlayLook
  position: number
  disabled: boolean
  onClick: () => void
}) {
  const verdict = state === 'right' || state === 'reveal' ? Check : state === 'wrong' ? X : null
  const bright = look.tiles === 'bright'
  // A bright tile waiting to be picked, or passed over, keeps its colour; a
  // quest tile keeps its coloured edge whatever happens.
  const tile =
    bright && (state === 'open' || state === 'dim')
      ? cn(marker.bright, 'border-4 hover:shadow-lg', state === 'dim' && 'opacity-55')
      : look.tiles === 'quest'
        ? cn(TILE[state], 'border-l-[10px]', marker.accent)
        : TILE[state]
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === 'locked' || state === 'right' || state === 'wrong'}
      whileHover={state === 'open' ? { y: -3 } : undefined}
      whileTap={state === 'open' ? { scale: 0.97, y: 1 } : undefined}
      animate={state === 'wrong' ? wobble : state === 'right' ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={spring.snappy}
      className={cn(
        'group relative flex w-full items-center gap-4 border-2 p-3 pr-4 text-left shadow-sm transition-[border-color,background-color,box-shadow,opacity]',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:cursor-default',
        look.tileSize,
        bright ? 'rounded-3xl' : 'rounded-2xl',
        tile,
      )}
    >
      <motion.span
        className={cn('grid shrink-0 place-items-center rounded-xl text-white shadow-press', bright ? 'size-14' : 'size-12', marker.tile)}
        aria-hidden
        animate={look.bob && state === 'open' ? { y: [0, -5, 0], rotate: [0, position % 2 ? 6 : -6, 0] } : { y: 0, rotate: 0 }}
        transition={look.bob && state === 'open' ? { duration: 1.8, repeat: Infinity, delay: position * 0.25, ease: 'easeInOut' } : spring.snappy}
      >
        <marker.Icon weight="fill" className={bright ? 'size-8' : 'size-6'} />
      </motion.span>
      <span className={cn('flex-1 leading-snug font-bold', look.tileText)}>{text}</span>
      {look.sparkle && state === 'right' && <SparkleBurst />}
      {verdict ? (
        <motion.span
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={spring.bouncy}
          className={cn('grid size-9 place-items-center rounded-full text-white', verdict === Check ? 'bg-correct' : 'bg-wrong')}
        >
          {verdict === Check ? <Check weight="bold" className="size-5" /> : <X weight="bold" className="size-5" />}
        </motion.span>
      ) : (
        <kbd className="hidden size-7 place-items-center rounded-lg border-2 border-border font-sans text-sm font-bold text-muted-foreground md:grid">
          {marker.key}
        </kbd>
      )}
    </motion.button>
  )
}
