/**
 * Sort It Out (§26): one card at a time, big in the middle, and the baskets
 * below. The child taps the basket it belongs in, or drags it there. A card
 * put in the wrong basket wobbles, the buddy says why, and it stays until it
 * is put right; each basket shows what is already in it.
 */
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { pop, spring } from '@/motion'
import { ReadIt, SHOW_ME_MS, SIZE, useFinish, useLater, useShowMe, useWobble } from './parts'
import { shuffled, type Shuffled } from './shuffle'
import type { Band, Basket, RoundProps, SortCard, SortContent } from './types'

type DragEnd = MouseEvent | TouchEvent | PointerEvent
// The baskets side by side, centred, as many across as there are — four go
// two by two on a phone.
const BASKET_GRID: Record<number, string> = {
  2: 'max-w-2xl grid-cols-2',
  3: 'max-w-4xl grid-cols-3',
  4: 'max-w-4xl grid-cols-2 lg:grid-cols-4',
}
// A basket's name: smaller on a phone, where three share its width.
const BASKET_LABEL: Record<Band, string> = {
  early: 'text-lg sm:text-2xl',
  middle: 'text-base sm:text-xl',
  secondary: 'text-base sm:text-lg',
}

export function SortItOut({ content, band, calm, say, sound, showMe, onMove, onDone, shuffle = shuffled }: RoundProps<SortContent> & Shuffled) {
  const [cards] = useState(() => shuffle(content.cards))
  // Each card put right, and the basket it went in.
  const [placed, setPlaced] = useState<Record<string, string>>({})
  const [showing, setShowing] = useState<string | null>(null)
  const [scope, shake] = useWobble(calm)
  const later = useLater()
  const current = cards.find((card) => !(card.id in placed)) ?? null
  const count = Object.keys(placed).length
  useFinish(cards.length > 0 && count === cards.length, onDone)

  const keep = (card: SortCard) => setPlaced((all) => ({ ...all, [card.id]: card.basket }))

  function put(basket: string) {
    if (!current || showing) return
    const right = basket === current.basket
    onMove({ piece: current.id, right })
    if (right) {
      sound('correct')
      keep(current)
      return
    }
    sound('wrong')
    say(current.why)
    shake(current.id)
  }

  useShowMe(showMe, () => {
    if (!current || showing) return
    setShowing(current.id)
    later(() => {
      keep(current)
      setShowing(null)
      sound('correct')
    }, SHOW_ME_MS)
  })

  const target = showing ? current?.basket : undefined
  return (
    <div ref={scope} className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <p className="mx-auto w-fit max-w-full rounded-full bg-surface/90 px-4 py-1 text-center font-display text-lg font-bold" aria-live="polite">
        {current ? `Card ${count + 1} of ${cards.length}` : 'All sorted!'}
      </p>
      <div className="grid min-h-48 flex-1 place-items-center">
        <AnimatePresence mode="wait">
          {current && <Face key={current.id} card={current} band={band} calm={calm} showing={showing === current.id} say={say} onDrop={put} />}
        </AnimatePresence>
      </div>
      <div className={cn('mx-auto grid w-full gap-3', BASKET_GRID[content.baskets.length] ?? BASKET_GRID[4])}>
        {content.baskets.map((basket) => (
          <BasketButton
            key={basket.id}
            basket={basket}
            band={band}
            calm={calm}
            current={current}
            inside={cards.filter((card) => placed[card.id] === basket.id)}
            pointed={target === basket.id}
            onPut={() => put(basket.id)}
          />
        ))}
      </div>
    </div>
  )
}

/** The card to sort, big — and draggable onto a basket. */
function Face({ card, band, calm, showing, say, onDrop }: {
  card: SortCard; band: Band; calm: boolean; showing: boolean; say: (text: string) => void; onDrop: (basket: string) => void
}) {  // fmt: skip
  const size = SIZE[band]
  return (
    <motion.div
      drag={!showing}
      dragSnapToOrigin
      whileDrag={calm ? undefined : { scale: 1.05, rotate: -2 }}
      onDragEnd={(event: DragEnd) => {
        const basket = basketAt(event)
        if (basket) onDrop(basket)
      }}
      initial={calm ? false : { opacity: 0, scale: 0.85, y: -16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={calm ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.4, y: 140 }}
      transition={spring.gentle}
      className="w-full max-w-md cursor-grab touch-none active:cursor-grabbing"
    >
      <div
        data-piece={card.id}
        className={cn(
          'flex flex-col items-center gap-2 rounded-3xl border-4 bg-surface p-5 text-center shadow-lg',
          showing ? 'border-primary ring-4 ring-primary/40' : 'border-surface',
        )}
      >
        {card.icon && <span className={cn(size.bigIcon, 'leading-none')} aria-hidden>{card.icon}</span>}
        <p className={cn('min-w-0 break-words font-display font-semibold', size.big)}>{card.text}</p>
        {band === 'early' && <ReadIt text={card.text} say={say} />}
      </div>
    </motion.div>
  )
}

function BasketButton({ basket, band, calm, current, inside, pointed, onPut }: {
  basket: Basket; band: Band; calm: boolean; current: SortCard | null; inside: SortCard[]; pointed: boolean; onPut: () => void
}) {  // fmt: skip
  const size = SIZE[band]
  return (
    <button
      type="button"
      data-basket={basket.id}
      onClick={onPut}
      disabled={!current}
      aria-label={current ? `Put '${current.text}' in ${basket.label}` : `${basket.label}: ${inside.length}`}
      className={cn(
        'flex min-h-28 min-w-0 flex-col items-center gap-1.5 rounded-3xl border-4 border-dashed bg-surface/90 p-3 text-center transition-colors',
        'hover:border-hover-border hover:bg-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
        pointed ? 'border-primary bg-selected ring-4 ring-primary/40' : 'border-border',
      )}
    >
      {basket.icon && <span className={cn(size.icon, 'leading-none')} aria-hidden>{basket.icon}</span>}
      <span className={cn('w-full break-words font-display font-semibold', BASKET_LABEL[band])}>{basket.label}</span>
      <motion.span
        key={inside.length}
        variants={pop}
        initial={calm || inside.length === 0 ? false : 'hidden'}
        animate="shown"
        className="rounded-full bg-star-soft px-2.5 font-bold tabular-nums"
        aria-hidden
      >
        {inside.length}
      </motion.span>
      {inside.length > 0 && (
        <span className="flex w-full flex-wrap justify-center gap-1" aria-hidden>
          {inside.map((card) => (
            <span key={card.id} className="min-w-0 break-words rounded-full bg-correct-soft px-2 py-0.5 text-sm font-semibold">
              {card.icon ? `${card.icon} ` : ''}
              {card.text}
            </span>
          ))}
        </span>
      )}
    </button>
  )
}

/** The basket under the pointer where a drag ended, if any. */
function basketAt(event: DragEnd): string | null {
  const point = 'changedTouches' in event ? event.changedTouches[0] : event
  if (!point || typeof document.elementsFromPoint !== 'function') return null
  for (const element of document.elementsFromPoint(point.clientX, point.clientY)) {
    const basket = element.closest<HTMLElement>('[data-basket]')
    if (basket?.dataset.basket) return basket.dataset.basket
  }
  return null
}
