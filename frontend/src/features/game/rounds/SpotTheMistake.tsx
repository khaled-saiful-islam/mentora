/**
 * Spot the Mistake (§26.8): someone's worked answer or paragraph, a line at a
 * time on a notebook page. The child taps the line they think is wrong. A
 * wrong line opens its fixes — which is right? — and the right one is written
 * in, the mistake struck through. Doubting a line that was right is a slip,
 * answered gently with why it is right.
 */
import { AnimatePresence, motion } from 'motion/react'
import { Check, CheckCircle, MagnifyingGlass, PencilSimple } from '@phosphor-icons/react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { ReadIt, SHOW_ME_MS, SIZE, useFinish, useLater, useShowMe, useWobble } from './parts'
import { shuffled, type Shuffled } from './shuffle'
import type { Band, MistakeContent, MistakeLine, RoundProps } from './types'

export function SpotTheMistake({ content, band, calm, say, sound, showMe, onMove, onDone, shuffle = shuffled }: RoundProps<MistakeContent> & Shuffled) {
  const lines = content.lines
  const wrongs = lines.filter((line) => line.wrong)
  // Each wrong line's fixes, shuffled once.
  const [choices] = useState(() => Object.fromEntries(wrongs.map((line) => [line.id, shuffle([line.fix, ...line.decoys])])))
  const [fixed, setFixed] = useState<string[]>([])
  const [trusted, setTrusted] = useState<string[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [showing, setShowing] = useState<string | null>(null)
  const [scope, shake] = useWobble(calm)
  const later = useLater()
  useFinish(wrongs.length > 0 && fixed.length === wrongs.length, onDone)

  const fix = (id: string) => setFixed((all) => (all.includes(id) ? all : [...all, id]))

  function tap(line: MistakeLine) {
    if (showing || fixed.includes(line.id)) return
    if (line.wrong) {
      sound('tap')
      setOpen(open === line.id ? null : line.id)
      return
    }
    // A right line doubted: a slip, answered with why it is right.
    setTrusted((all) => (all.includes(line.id) ? all : [...all, line.id]))
    sound('tap')
    say(line.why)
    onMove({ piece: line.id, right: false })
  }

  function pick(line: MistakeLine, choice: string) {
    if (showing) return
    const right = choice === line.fix
    onMove({ piece: line.id, right })
    say(line.why)
    if (right) {
      sound('correct')
      fix(line.id)
      setOpen(null)
      return
    }
    sound('wrong')
    shake(`fix:${line.id}:${choice}`)
  }

  useShowMe(showMe, () => {
    const line = wrongs.find((l) => !fixed.includes(l.id))
    if (!line || showing) return
    setOpen(line.id)
    setShowing(line.id)
    later(() => {
      fix(line.id)
      setOpen(null)
      setShowing(null)
      sound('correct')
    }, SHOW_ME_MS)
  })

  const left = wrongs.length - fixed.length
  return (
    <div ref={scope} className="h-full min-h-0 overflow-y-auto p-3 sm:p-6">
      <p className="mx-auto mb-3 flex w-fit max-w-full items-center gap-2 break-words rounded-full bg-surface/90 px-4 py-1 text-center font-display text-lg font-bold" aria-live="polite">
        <MagnifyingGlass weight="bold" className="size-5 shrink-0 text-primary" aria-hidden />
        {left === 0 ? 'Every mistake fixed!' : left === 1 ? '1 mistake to find' : `${left} mistakes to find`}
      </p>
      <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-surface shadow-lg">
        <h3 className="border-b-2 border-sky-100 px-5 pb-2 pt-4 font-display text-xl font-semibold dark:border-sky-700/40">{content.title}</h3>
        <ol aria-label={content.title} className="border-l-4 border-coral-400/50 ml-10 sm:ml-12">
          {lines.map((line, n) => (
            <Line
              key={line.id}
              number={n + 1}
              line={line}
              band={band}
              calm={calm}
              fixed={fixed.includes(line.id)}
              trusted={trusted.includes(line.id)}
              open={open === line.id}
              showing={showing === line.id}
              choices={choices[line.id] ?? []}
              say={say}
              onTap={() => tap(line)}
              onPick={(choice) => pick(line, choice)}
            />
          ))}
        </ol>
      </article>
    </div>
  )
}

function Line({ number, line, band, calm, fixed, trusted, open, showing, choices, say, onTap, onPick }: {
  number: number; line: MistakeLine; band: Band; calm: boolean; fixed: boolean; trusted: boolean; open: boolean; showing: boolean
  choices: string[]; say: (text: string) => void; onTap: () => void; onPick: (choice: string) => void
}) {  // fmt: skip
  const size = SIZE[band].piece
  return (
    <li className="relative border-b-2 border-sky-100 dark:border-sky-700/40">
      <span aria-hidden className="absolute -left-9 top-3 w-6 text-right font-display text-sm font-bold text-muted-foreground sm:-left-11">{number}</span>
      <div className="flex items-start gap-1 px-3 py-2">
        <button
          type="button"
          onClick={onTap}
          disabled={fixed}
          aria-expanded={line.wrong ? open : undefined}
          aria-label={fixed ? `Line ${number}, fixed: ${line.fix}` : `Line ${number}: ${line.text}`}
          className={cn(
            'min-h-12 min-w-0 flex-1 rounded-xl px-2 py-1 text-left transition-colors',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
            !fixed && 'hover:bg-hover',
            open && 'bg-selected',
          )}
        >
          <span className={cn('block break-words font-semibold', size, fixed && 'text-muted-foreground line-through decoration-wrong decoration-2')}>{line.text}</span>
          {fixed && (
            <span className={cn('mt-1 flex items-start gap-2 break-words font-display font-semibold text-success', size)}>
              <PencilSimple weight="bold" className="mt-1 size-5 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{line.fix}</span>
            </span>
          )}
          {trusted && !line.wrong && (
            <span className="mt-1 flex items-center gap-1.5 text-sm font-bold text-success">
              <CheckCircle weight="fill" className="size-4 shrink-0" aria-hidden />
              This one is right
            </span>
          )}
        </button>
        {band === 'early' && <ReadIt text={line.text} say={say} />}
      </div>
      <AnimatePresence initial={false}>
        {open && !fixed && <Fixes line={line} calm={calm} showing={showing} choices={choices} size={size} onPick={onPick} />}
      </AnimatePresence>
    </li>
  )
}

/** A wrong line's fixes: which is right? */
function Fixes({ line, calm, showing, choices, size, onPick }: { line: MistakeLine; calm: boolean; showing: boolean; choices: string[]; size: string; onPick: (choice: string) => void }) {
  return (
    <motion.div
      initial={calm ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={calm ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
      transition={spring.gentle}
      className="overflow-hidden"
    >
      <div className="space-y-2 bg-muted/40 px-3 pb-3 pt-2">
        <p className="font-display font-bold">Which is right?</p>
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            data-piece={`fix:${line.id}:${choice}`}
            onClick={() => onPick(choice)}
            className={cn(
              'flex min-h-12 w-full items-start gap-2 rounded-2xl border-2 px-3 py-2 text-left font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
              size,
              showing && choice === line.fix ? 'border-primary bg-selected ring-4 ring-primary/40' : 'border-border bg-surface hover:border-hover-border hover:bg-hover',
            )}
          >
            <Check weight="bold" className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 break-words">{choice}</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
