/**
 * Escape Room (§26.8): two to four locked doors, one after another. Each has
 * a puzzle whose answer is its code — typed on a keypad, spelled with letter
 * tiles, or picked from a few symbols. The right code swings the door open
 * and the buddy says why; a wrong one rattles the padlock and clears it.
 */
import { motion } from 'motion/react'
import { Backspace, DoorOpen, KeyReturn, Lock, LockOpen } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { ReadIt, SHOW_ME_MS, SIZE, useFinish, useLater, useShowMe, useWobble } from './parts'
import { shuffled, type Shuffled, type Shuffler } from './shuffle'
import type { Band, EscapeContent, EscapeDoor, RoundProps } from './types'

// Letters added to a word's tiles so the last one is not a giveaway.
const DECOYS = 'AEIRSTLNOM'
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '-']
// How long Show me takes over each character of a code.
const TYPE_MS = 260

/** The same code: numbers by value ("3/4" is "0.75"), the rest by its words. */
export function sameCode(given: string, answer: string): boolean {
  const a = valueOf(given)
  const b = valueOf(answer)
  if (a !== null && b !== null) return Math.abs(a - b) < 1e-9
  const words = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ')
  return words(given) === words(answer)
}

function valueOf(text: string): number | null {
  const clean = text.trim()
  const fraction = /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(clean)
  if (fraction) return Number(fraction[2]) === 0 ? null : Number(fraction[1]) / Number(fraction[2])
  return /^-?\d+(?:\.\d+)?$/.test(clean) ? Number(clean) : null
}

export function EscapeRoom({ content, band, calm, say, sound, showMe, onMove, onDone, shuffle = shuffled }: RoundProps<EscapeContent> & Shuffled) {
  const doors = content.doors
  const [opened, setOpened] = useState<string[]>([])
  const [code, setCode] = useState('')
  const [showing, setShowing] = useState(false)
  const [scope, shake] = useWobble(calm)
  const later = useLater()
  const current = doors.find((door) => !opened.includes(door.id)) ?? null
  useFinish(doors.length > 0 && opened.length === doors.length, onDone)

  function open(door: EscapeDoor) {
    setOpened((all) => (all.includes(door.id) ? all : [...all, door.id]))
    setCode('')
  }

  function submit(given: string) {
    if (!current || showing) return
    const right = sameCode(given, current.answer)
    onMove({ piece: current.id, right })
    say(current.why)
    if (right) {
      sound('correct')
      open(current)
      return
    }
    sound('wrong')
    shake(`door:${current.id}`)
    setCode('')
  }

  useShowMe(showMe, () => {
    if (!current || showing) return
    setShowing(true)
    const typed = current.kind === 'word' ? letters(current.answer).join('') : current.answer
    setCode('')
    ;[...typed].forEach((_, n) => later(() => setCode(typed.slice(0, n + 1)), TYPE_MS * (n + 1)))
    later(() => {
      open(current)
      setShowing(false)
      sound('correct')
    }, TYPE_MS * typed.length + SHOW_ME_MS)
  })

  return (
    <div ref={scope} className="h-full min-h-0 overflow-y-auto p-3 sm:p-6">
      <p className="mx-auto mb-3 w-fit max-w-full break-words rounded-full bg-surface/90 px-4 py-1 text-center font-display text-lg font-bold" aria-live="polite">
        {current ? `Door ${doors.indexOf(current) + 1} of ${doors.length}` : 'You escaped!'}
      </p>
      <ol aria-label="The doors" className="mx-auto mb-4 flex max-w-3xl flex-wrap justify-center gap-2">
        {doors.map((door, n) => (
          <DoorBadge key={door.id} number={n + 1} open={opened.includes(door.id)} current={current?.id === door.id} calm={calm} />
        ))}
      </ol>
      {current && (
        <Puzzle key={current.id} door={current} number={doors.indexOf(current) + 1} band={band} calm={calm} code={code} showing={showing} shuffle={shuffle} say={say} sound={sound} onCode={setCode} onSubmit={submit} />
      )}
    </div>
  )
}

function DoorBadge({ number, open, current, calm }: { number: number; open: boolean; current: boolean; calm: boolean }) {
  return (
    <li
      aria-label={`Door ${number}: ${open ? 'open' : current ? 'locked — this one now' : 'locked'}`}
      className={cn(
        'flex items-center gap-1.5 rounded-2xl border-2 px-3 py-2 font-display font-bold',
        open ? 'border-correct bg-correct-soft text-success' : current ? 'border-primary bg-selected text-primary' : 'border-border bg-surface/90 text-muted-foreground',
      )}
    >
      <motion.span animate={open && !calm ? { rotateY: [0, -70, 0] } : undefined} transition={{ duration: 0.6 }} aria-hidden>
        {open ? <DoorOpen weight="fill" className="size-5" /> : <Lock weight="fill" className="size-5" />}
      </motion.span>
      {number}
    </li>
  )
}

/** The door being opened: its puzzle, and the way in for its code. */
function Puzzle({ door, number, band, calm, code, showing, shuffle, say, sound, onCode, onSubmit }: {
  door: EscapeDoor; number: number; band: Band; calm: boolean; code: string; showing: boolean; shuffle: Shuffler
  say: (text: string) => void; sound: RoundProps<EscapeContent>['sound']; onCode: (code: string) => void; onSubmit: (code: string) => void
}) {  // fmt: skip
  return (
    <motion.section
      aria-label={`Door ${number}`}
      initial={calm ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
      className="mx-auto max-w-2xl rounded-3xl bg-surface p-4 shadow-lg sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span data-piece={`door:${door.id}`} className="grid size-16 shrink-0 place-items-center rounded-2xl bg-muted text-4xl" aria-hidden>
          {door.icon || <Lock weight="fill" className="size-8 text-primary" />}
        </span>
        <p className={cn('min-w-0 flex-1 break-words font-display font-semibold', SIZE[band].piece)}>{door.puzzle}</p>
        {band === 'early' && <ReadIt text={door.puzzle} say={say} />}
      </div>
      <div className="mt-4">
        {door.kind === 'choice' && <Choices door={door} band={band} showing={showing} code={code} onSubmit={onSubmit} />}
        {door.kind === 'number' && <Keypad code={code} showing={showing} sound={sound} onCode={onCode} onSubmit={onSubmit} />}
        {door.kind === 'word' && <Tiles door={door} code={code} showing={showing} shuffle={shuffle} sound={sound} onCode={onCode} onSubmit={onSubmit} />}
      </div>
    </motion.section>
  )
}

function Choices({ door, band, showing, code, onSubmit }: { door: EscapeDoor; band: Band; showing: boolean; code: string; onSubmit: (code: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {door.options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSubmit(option)}
          disabled={showing}
          className={cn(
            'min-h-14 min-w-0 break-words rounded-2xl border-2 px-4 py-2 text-left font-display font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
            SIZE[band].piece,
            showing && sameCode(code, option) && code ? 'border-primary bg-selected ring-4 ring-primary/40' : 'border-border bg-surface hover:border-hover-border hover:bg-hover',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

/** A number, typed on a keypad. */
function Keypad({ code, showing, sound, onCode, onSubmit }: { code: string; showing: boolean; sound: RoundProps<EscapeContent>['sound']; onCode: (code: string) => void; onSubmit: (code: string) => void }) {
  const press = (key: string) => {
    sound('tap')
    onCode((code + key).slice(0, 12))
  }
  return (
    <div className="mx-auto max-w-xs">
      <output aria-label="The code" className="mb-3 flex min-h-14 items-center justify-center rounded-2xl border-2 border-border bg-muted/40 px-3 font-display text-3xl font-bold tabular-nums tracking-widest">
        {code || <span className="text-muted-foreground">?</span>}
      </output>
      <div className="grid grid-cols-3 gap-2">
        {[...KEYS, '/'].map((key) => (
          <button key={key} type="button" disabled={showing} onClick={() => press(key)} aria-label={`Type ${key}`} className="min-h-14 rounded-2xl border-2 border-border bg-surface font-display text-2xl font-bold hover:bg-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring">
            {key}
          </button>
        ))}
        <button type="button" disabled={showing || !code} onClick={() => onCode(code.slice(0, -1))} aria-label="Delete" className="grid min-h-14 place-items-center rounded-2xl border-2 border-border bg-surface hover:bg-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:opacity-40">
          <Backspace weight="bold" className="size-6" />
        </button>
        <Button type="button" variant="sun" disabled={showing || !code} onClick={() => onSubmit(code)} className="h-auto min-h-14 rounded-2xl px-2">
          <KeyReturn weight="bold" className="size-6" />
          Open
        </Button>
      </div>
    </div>
  )
}

/** A word, spelled with letter tiles: tap a tile to fill the next blank, a
 *  filled blank to give its letter back. */
function Tiles({ door, code, showing, shuffle, sound, onCode, onSubmit }: {
  door: EscapeDoor; code: string; showing: boolean; shuffle: Shuffler; sound: RoundProps<EscapeContent>['sound']; onCode: (code: string) => void; onSubmit: (code: string) => void
}) {  // fmt: skip
  const answer = letters(door.answer)
  const [tiles] = useState(() => shuffle([...answer, ...decoysFor(answer)]).map((letter, n) => ({ id: n, letter })))
  // The tiles used, in the order they fill the blanks.
  const [used, setUsed] = useState<number[]>([])
  // A wrong code is cleared by the door: every tile comes back.
  useEffect(() => {
    if (!code && !showing) setUsed([])
  }, [code, showing])
  // Show me types the code itself: the blanks follow it.
  const shown = showing ? [...code] : used.map((id) => tiles[id].letter)
  const set = (next: number[]) => {
    setUsed(next)
    onCode(next.map((id) => tiles[id].letter).join(''))
  }
  return (
    <div className="space-y-4">
      <div aria-label="The word" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {groups(door.answer).map((size, g) => (
          <span key={g} className="flex gap-1.5">
            {Array.from({ length: size }, (_, i) => {
              const at = groups(door.answer).slice(0, g).reduce((sum, n) => sum + n, 0) + i
              const letter = shown[at]
              return (
                <button
                  key={at}
                  type="button"
                  disabled={showing || !letter}
                  onClick={() => set(used.filter((_, n) => n !== at))}
                  aria-label={letter ? `Give back ${letter}` : `Blank ${at + 1}`}
                  className="grid size-12 place-items-center rounded-xl border-b-4 border-primary bg-muted/40 font-display text-2xl font-bold uppercase"
                >
                  {letter ?? ''}
                </button>
              )
            })}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            disabled={showing || used.includes(tile.id) || used.length >= answer.length}
            onClick={() => {
              sound('tap')
              set([...used, tile.id])
            }}
            aria-label={`Letter ${tile.letter}`}
            className="grid size-12 place-items-center rounded-xl border-2 border-border bg-surface font-display text-2xl font-bold shadow-sm hover:bg-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:opacity-30"
          >
            {tile.letter}
          </button>
        ))}
      </div>
      <div className="flex justify-center">
        <Button type="button" variant="sun" size="lg" disabled={showing || used.length < answer.length} onClick={() => onSubmit(code)}>
          <LockOpen weight="bold" className="size-6" />
          Open
        </Button>
      </div>
    </div>
  )
}

/** A word's letters, capitals, without its spaces. */
function letters(answer: string): string[] {
  return [...answer.toUpperCase()].filter((ch) => ch.trim() !== '')
}

/** How many letters each word of the answer has. */
function groups(answer: string): number[] {
  return answer.trim().split(/\s+/).map((word) => letters(word).length).filter((n) => n > 0)
}

/** Two or three letters that are not in the word. */
function decoysFor(answer: string[]): string[] {
  const spare = [...DECOYS].filter((ch) => !answer.includes(ch))
  return spare.slice(0, answer.length > 6 ? 3 : 2)
}
