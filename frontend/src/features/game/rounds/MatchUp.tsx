/**
 * Match Up (§26): a word and its meaning, a cause and its effect, a fraction
 * and its picture. Each left card has an empty slot beside it; the answers
 * wait in a tray. The child drags an answer into its slot — or taps it, then
 * the slot (or the slot, then the answer). A right one snaps in and the row
 * turns green with why they belong together; a wrong one wobbles back to the
 * tray and the buddy says why.
 */
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { ArrowRight, LinkSimple, Sparkle } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { pop, spring } from '@/motion'
import { ReadIt, SHOW_ME_MS, SIZE, useFinish, useLater, useShowMe, useWobble } from './parts'
import { outOfOrder, shuffled, type Shuffled } from './shuffle'
import type { Band, MatchContent, Pair, RoundProps } from './types'

type DragEnd = MouseEvent | TouchEvent | PointerEvent

/** What the child has in hand: an answer from the tray, or an empty slot. */
interface Picked {
  kind: 'chip' | 'slot'
  /** The pair it belongs to. */
  id: string
}

export function MatchUp({ content, band, calm, say, sound, showMe, onMove, onDone, shuffle = shuffled }: RoundProps<MatchContent> & Shuffled) {
  const pairs = content.pairs
  const [tray] = useState(() => outOfOrder(pairs, shuffle))
  // Pair ids whose slot is filled, in the order they were filled.
  const [filled, setFilled] = useState<string[]>([])
  const [picked, setPicked] = useState<Picked | null>(null)
  const [showing, setShowing] = useState<string | null>(null)
  const [scope, shake] = useWobble(calm)
  const later = useLater()
  useFinish(pairs.length > 0 && filled.length === pairs.length, onDone)

  const fill = (id: string) => setFilled((all) => (all.includes(id) ? all : [...all, id]))

  function attempt(slot: string, chip: string) {
    setPicked(null)
    const right = slot === chip
    onMove({ piece: slot, right })
    if (right) {
      sound('correct')
      fill(slot)
      return
    }
    sound('wrong')
    say(pairs.find((pair) => pair.id === slot)?.why ?? '')
    shake(`chip:${chip}`)
    shake(`slot:${slot}`)
  }

  function choose(kind: Picked['kind'], id: string) {
    if (showing || filled.includes(id)) return
    if (picked && picked.kind !== kind) {
      attempt(kind === 'slot' ? id : picked.id, kind === 'chip' ? id : picked.id)
      return
    }
    sound('tap')
    setPicked(picked?.kind === kind && picked.id === id ? null : { kind, id })
  }

  useShowMe(showMe, () => {
    const pair = pairs.find((p) => !filled.includes(p.id))
    if (!pair || showing) return
    setPicked(null)
    setShowing(pair.id)
    later(() => {
      fill(pair.id)
      setShowing(null)
      sound('correct')
    }, SHOW_ME_MS)
  })

  const left = pairs.length - filled.length
  return (
    <LayoutGroup id="match-up">
      <div ref={scope} className="flex h-full min-h-0 flex-col overflow-y-auto">
        <p className="mx-auto mt-3 w-fit max-w-[calc(100%-1.5rem)] break-words rounded-full bg-surface/90 px-4 py-1 text-center font-display text-lg font-bold" aria-live="polite">
          {promptFor(pairs, filled, picked)}
        </p>
        <div className="mx-auto grid w-full max-w-5xl flex-1 gap-4 p-3 sm:p-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <ol aria-label="Match these" className="min-w-0 space-y-3">
            {pairs.map((pair) => (
              <Row
                key={pair.id}
                pair={pair}
                band={band}
                calm={calm}
                filled={filled.includes(pair.id)}
                picked={picked?.kind === 'slot' && picked.id === pair.id}
                pointed={showing === pair.id}
                say={say}
                onChoose={() => choose('slot', pair.id)}
              />
            ))}
          </ol>
          <Tray band={band} done={left === 0}>
            <AnimatePresence initial={false}>
              {tray
                .filter((pair) => !filled.includes(pair.id))
                .map((pair) => (
                  <Chip
                    key={pair.id}
                    pair={pair}
                    band={band}
                    calm={calm}
                    picked={picked?.kind === 'chip' && picked.id === pair.id}
                    pointed={showing === pair.id}
                    say={say}
                    onChoose={() => choose('chip', pair.id)}
                    onDrop={(slot) => {
                      if (!filled.includes(slot) && !showing) attempt(slot, pair.id)
                    }}
                  />
                ))}
            </AnimatePresence>
          </Tray>
        </div>
      </div>
    </LayoutGroup>
  )
}

/** What to do now, in a child's words. */
function promptFor(pairs: Pair[], filled: string[], picked: Picked | null): string {
  if (filled.length === pairs.length) return 'All matched!'
  const holding = picked ? pairs.find((pair) => pair.id === picked.id) : undefined
  if (holding && picked?.kind === 'chip') return `Now tap where '${holding.right}' goes`
  if (holding) return `Now pick what goes with '${holding.left}'`
  return `Drag each answer to its partner — ${filled.length} of ${pairs.length} matched`
}

/** A left card, the link to its slot, and the slot — green with its answer
 *  and why once filled. */
function Row({ pair, band, calm, filled, picked, pointed, say, onChoose }: {
  pair: Pair; band: Band; calm: boolean; filled: boolean; picked: boolean; pointed: boolean; say: (text: string) => void; onChoose: () => void
}) {  // fmt: skip
  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-3xl border-2 p-3 transition-colors sm:flex-row sm:items-stretch',
        filled ? 'border-correct bg-correct-soft' : 'border-surface bg-surface/90',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <p className={cn('min-w-0 flex-1 break-words font-display font-semibold', SIZE[band].piece)}>{pair.left}</p>
        {band === 'early' && <ReadIt text={pair.left} say={say} />}
        <span aria-hidden className={cn('hidden shrink-0 sm:block', filled ? 'text-success' : 'text-muted-foreground')}>
          {filled ? <LinkSimple weight="bold" className="size-6" /> : <ArrowRight weight="bold" className="size-6" />}
        </span>
      </div>
      <button
        type="button"
        data-slot={pair.id}
        data-piece={`slot:${pair.id}`}
        onClick={onChoose}
        disabled={filled}
        aria-pressed={filled ? undefined : picked}
        aria-label={filled ? `'${pair.left}' goes with '${pair.right}'` : `Slot for '${pair.left}'`}
        className={cn(
          'relative flex min-h-14 min-w-0 flex-1 flex-col justify-center rounded-2xl border-2 px-3 py-2 text-left transition-colors',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
          filled && 'border-correct bg-surface',
          !filled && 'border-dashed',
          !filled && (picked || pointed ? 'border-primary bg-selected ring-4 ring-primary/40' : 'border-border bg-muted/40 hover:border-hover-border hover:bg-hover'),
        )}
      >
        {filled ? <Snapped pair={pair} band={band} calm={calm} /> : <span className="font-semibold text-muted-foreground">{picked ? 'Now pick its answer' : 'Drop the answer here'}</span>}
      </button>
    </li>
  )
}

/** An answer in its slot, flown there from the tray, with why it fits. */
function Snapped({ pair, band, calm }: { pair: Pair; band: Band; calm: boolean }) {
  return (
    <>
      <motion.span layoutId={calm ? undefined : `match-${pair.id}`} transition={spring.snappy} className={cn('flex min-w-0 items-start gap-2 font-display font-semibold', SIZE[band].piece)}>
        <LinkSimple weight="bold" className="mt-1 size-5 shrink-0 text-success sm:hidden" aria-hidden />
        <span className="min-w-0 break-words">{pair.right}</span>
      </motion.span>
      {pair.why && <span className="mt-1 block break-words text-sm text-muted-foreground">{pair.why}</span>}
      {!calm && (
        <motion.span variants={pop} initial="hidden" animate="shown" aria-hidden className="absolute -right-2 -top-2 grid size-8 place-items-center rounded-full bg-sun-400 text-grape-900 shadow">
          <Sparkle weight="fill" className="size-4" />
        </motion.span>
      )}
    </>
  )
}

/** Where the answers wait: stuck to the bottom of a phone's screen, under
 *  the rows on a tablet, beside them on a wide screen. */
function Tray({ band, done, children }: { band: Band; done: boolean; children: React.ReactNode }) {
  return (
    <section aria-label="Answers" className="sticky bottom-0 z-10 -mx-3 rounded-t-3xl border-t-2 border-border bg-surface/95 p-3 shadow-lg backdrop-blur-sm sm:mx-0 sm:rounded-3xl sm:border-2 lg:bottom-auto lg:top-0">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Answers</p>
      <ul className={cn('flex max-h-[38vh] flex-wrap overflow-y-auto lg:max-h-none', band === 'early' ? 'gap-3' : 'gap-2')}>{children}</ul>
      {done && <p className="text-center font-semibold text-muted-foreground">Every answer is in its place.</p>}
    </section>
  )
}

/** An answer: dragged onto a slot, or tapped to pick it up. */
function Chip({ pair, band, calm, picked, pointed, say, onChoose, onDrop }: {
  pair: Pair; band: Band; calm: boolean; picked: boolean; pointed: boolean; say: (text: string) => void; onChoose: () => void; onDrop: (slot: string) => void
}) {  // fmt: skip
  // A drag ends with a click on the chip it started from: that is not a tap.
  const dragged = useRef(false)
  return (
    <motion.li
      layout={!calm}
      initial={calm ? false : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: calm ? 0 : 0.15 } }}
      transition={spring.gentle}
      className="flex min-w-0 max-w-full items-center gap-1"
    >
      <motion.button
        type="button"
        layoutId={calm ? undefined : `match-${pair.id}`}
        data-piece={`chip:${pair.id}`}
        drag
        dragSnapToOrigin
        whileDrag={calm ? undefined : { scale: 1.08, rotate: -2, zIndex: 30 }}
        onDragStart={() => {
          dragged.current = true
        }}
        onDragEnd={(event: DragEnd) => {
          const slot = slotAt(event)
          if (slot) onDrop(slot)
        }}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false
            return
          }
          onChoose()
        }}
        aria-pressed={picked}
        className={cn(
          'min-h-12 min-w-0 max-w-full cursor-grab touch-none break-words rounded-2xl border-2 px-4 py-2 text-left font-display font-semibold shadow-sm transition-colors active:cursor-grabbing',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
          band === 'secondary' ? 'text-base sm:text-lg' : SIZE[band].piece,
          picked || pointed ? 'border-primary bg-selected shadow-md ring-4 ring-primary/40' : 'border-border bg-surface hover:border-hover-border hover:bg-hover',
        )}
      >
        {pair.right}
      </motion.button>
      {band === 'early' && <ReadIt text={pair.right} say={say} />}
    </motion.li>
  )
}

/** The slot under the pointer where a drag ended, if any. */
function slotAt(event: DragEnd): string | null {
  const point = 'changedTouches' in event ? event.changedTouches[0] : event
  if (!point || typeof document.elementsFromPoint !== 'function') return null
  for (const element of document.elementsFromPoint(point.clientX, point.clientY)) {
    const slot = element.closest<HTMLElement>('[data-slot]')
    if (slot?.dataset.slot) return slot.dataset.slot
  }
  return null
}
