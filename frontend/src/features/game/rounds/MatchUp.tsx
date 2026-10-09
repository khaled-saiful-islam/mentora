/**
 * Match Up (§26): two columns — a word and its meaning, a cause and its
 * effect, a formula and its use. The child taps one on each side to join
 * them. A right pair locks in the same colour and number on both sides, with
 * why they belong together; a wrong one wobbles and the buddy says why.
 */
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ReadIt, SHOW_ME_MS, SIZE, useFinish, useLater, useShowMe, useWobble } from './parts'
import { outOfOrder, shuffled, type Shuffled } from './shuffle'
import type { Band, MatchContent, Pair, RoundProps } from './types'

type Side = 'left' | 'right'

interface Picked {
  side: Side
  /** The pair the tapped piece belongs to. */
  id: string
}

// A joined pair's colours, in the order pairs are joined.
const PAIR_LOOKS = [
  'border-grape-400 bg-grape-100 dark:bg-grape-700/30',
  'border-sky-400 bg-sky-100 dark:bg-sky-700/30',
  'border-mint-400 bg-mint-100 dark:bg-mint-700/30',
  'border-sun-400 bg-sun-100 dark:bg-sun-600/30',
  'border-coral-400 bg-coral-100 dark:bg-coral-700/30',
]

export function MatchUp({ content, band, calm, say, sound, showMe, onMove, onDone, shuffle = shuffled }: RoundProps<MatchContent> & Shuffled) {
  const pairs = content.pairs
  const [rights] = useState(() => outOfOrder(pairs, shuffle))
  // Pair ids, in the order they were joined.
  const [joined, setJoined] = useState<string[]>([])
  const [picked, setPicked] = useState<Picked | null>(null)
  const [showing, setShowing] = useState<string | null>(null)
  const [scope, shake] = useWobble(calm)
  const later = useLater()
  useFinish(pairs.length > 0 && joined.length === pairs.length, onDone)

  function choose(side: Side, id: string) {
    if (showing || joined.includes(id)) return
    if (!picked || picked.side === side) {
      setPicked(picked?.side === side && picked.id === id ? null : { side, id })
      sound('tap')
      return
    }
    const left = side === 'left' ? id : picked.id
    const right = side === 'right' ? id : picked.id
    setPicked(null)
    onMove({ piece: left, right: left === right })
    if (left === right) {
      sound('correct')
      setJoined((all) => [...all, left])
      return
    }
    sound('wrong')
    say(pairs.find((pair) => pair.id === left)?.why ?? '')
    shake(`left:${left}`)
    shake(`right:${right}`)
  }

  useShowMe(showMe, () => {
    const pair = pairs.find((p) => !joined.includes(p.id))
    if (!pair || showing) return
    setPicked(null)
    setShowing(pair.id)
    later(() => {
      setJoined((all) => (all.includes(pair.id) ? all : [...all, pair.id]))
      setShowing(null)
      sound('correct')
    }, SHOW_ME_MS)
  })

  const pickedPair = picked ? pairs.find((pair) => pair.id === picked.id) : undefined
  const pickedText = pickedPair && picked ? pickedPair[picked.side] : ''
  const piece = (side: Side, pair: Pair) => (
    <Piece
      side={side}
      pair={pair}
      band={band}
      number={joined.indexOf(pair.id)}
      picked={picked?.side === side && picked.id === pair.id}
      pointed={showing === pair.id}
      onChoose={() => choose(side, pair.id)}
    />
  )
  return (
    <div ref={scope} className="h-full min-h-0 overflow-y-auto p-3 sm:p-6">
      <div className="mb-3 flex min-h-12 flex-wrap items-center justify-center gap-1 text-center" aria-live="polite">
        <p className="min-w-0 break-words rounded-full bg-surface/90 px-4 py-1 font-display text-lg font-bold">
          {joined.length === pairs.length ? 'All matched!' : pickedText ? `Now find the partner of '${pickedText}'` : 'Tap one on each side to join them'}
        </p>
        {band === 'early' && pickedText && <ReadIt text={pickedText} say={say} />}
      </div>
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-2 sm:gap-6">
        <ul aria-label="Match these" className="min-w-0 space-y-2">
          {pairs.map((pair) => (
            <li key={pair.id}>{piece('left', pair)}</li>
          ))}
        </ul>
        <ul aria-label="With these" className="min-w-0 space-y-2">
          {rights.map((pair) => (
            <li key={pair.id}>{piece('right', pair)}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Piece({ side, pair, band, number, picked, pointed, onChoose }: {
  side: Side; pair: Pair; band: Band; number: number; picked: boolean; pointed: boolean; onChoose: () => void
}) {  // fmt: skip
  const joined = number >= 0
  return (
    <button
      type="button"
      data-piece={`${side}:${pair.id}`}
      onClick={onChoose}
      disabled={joined}
      aria-pressed={picked}
      className={cn(
        'flex min-h-12 w-full min-w-0 items-start gap-2 rounded-2xl border-2 p-3 text-left font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
        band === 'secondary' ? 'text-base sm:text-lg' : SIZE[band].piece,
        joined ? PAIR_LOOKS[number % PAIR_LOOKS.length] : picked || pointed ? 'border-primary bg-selected ring-4 ring-primary/40' : 'border-border bg-surface hover:border-hover-border hover:bg-hover',
      )}
    >
      {joined && (
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-surface text-sm font-bold">
          {number + 1}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block break-words">{pair[side]}</span>
        {joined && side === 'left' && pair.why && <span className="mt-1 block break-words text-sm font-normal text-muted-foreground">{pair.why}</span>}
      </span>
    </button>
  )
}
