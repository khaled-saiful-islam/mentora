import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import { Translate } from '@phosphor-icons/react'
import type { GuideTerm } from '@/features/learning/api'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { markTerms, paragraphs, sentenceAt } from './text'

/**
 * A section's teaching, in paragraphs. The words to know are underlined in
 * dots and open their meaning — and their Malay — when tapped. While it is
 * read aloud, the sentence being spoken lights up instead.
 */
export function TermText({
  text,
  terms,
  reading,
  translationLabel,
  className,
}: {
  text: string
  terms: GuideTerm[]
  /** The character being read aloud, or null when nobody is reading. */
  reading: number | null
  translationLabel: string
  className?: string
}) {
  if (reading !== null) return <Spoken text={text} at={reading} className={className} />
  const seen = new Set<string>()
  return (
    <div className={cn('space-y-4', className)}>
      {paragraphs(text).map((paragraph, i) => (
        <p key={i}>
          {markTerms(paragraph, terms, seen).map((piece, j) =>
            piece.term ? (
              <Term key={j} term={piece.term} label={translationLabel}>
                {piece.text}
              </Term>
            ) : (
              <span key={j}>{piece.text}</span>
            ),
          )}
        </p>
      ))}
    </div>
  )
}

function Spoken({ text, at, className }: { text: string; at: number; className?: string }) {
  const [start, end] = sentenceAt(text, at)
  let offset = 0
  return (
    <div className={cn('space-y-4', className)} aria-live="off">
      {text.split('\n\n').map((paragraph, i) => {
        const from = offset
        offset += paragraph.length + 2
        const s = Math.max(start - from, 0)
        const e = Math.min(end - from, paragraph.length)
        if (e <= 0 || s >= paragraph.length) return <p key={i}>{paragraph}</p>
        return (
          <p key={i}>
            {paragraph.slice(0, s)}
            <mark className="rounded-md bg-sun-300/70 px-0.5 text-foreground transition-colors dark:bg-sun-600/50">
              {paragraph.slice(s, e)}
            </mark>
            {paragraph.slice(e)}
          </p>
        )
      })}
    </div>
  )
}

const POPOVER_WIDTH = 256
/** About as tall as a meaning with its translation gets. */
const POPOVER_ROOM = 190

function Term({ term, label, children }: { term: GuideTerm; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  // Opened toward the middle of the screen, so a word near the edge does
  // not push its meaning off the side of a phone.
  const [toLeft, setToLeft] = useState(false)
  // And above the word when there is no room below it.
  const [above, setAbove] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  const id = useId()

  function toggle() {
    const rect = box.current?.getBoundingClientRect()
    if (rect) {
      setToLeft(rect.left + POPOVER_WIDTH > window.innerWidth - 12)
      setAbove(rect.bottom + POPOVER_ROOM > window.innerHeight && rect.top > POPOVER_ROOM)
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <span ref={box} className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={id}
        className="rounded-md font-bold text-kind-study-guide underline decoration-kind-study-guide-vivid decoration-dotted decoration-2 underline-offset-4 hover:bg-kind-study-guide-vivid/10 dark:text-kind-study-guide"
      >
        {children}
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="note"
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            style={{ width: POPOVER_WIDTH }}
            className={cn(
              'absolute z-20 block max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border bg-surface p-3.5 text-left text-base font-normal leading-snug text-foreground shadow-lg',
              toLeft ? 'right-0' : 'left-0',
              above ? 'bottom-full mb-2' : 'top-full mt-2',
            )}
          >
            <span className="block font-display text-lg font-bold">{term.term}</span>
            <span className="mt-1 block">{term.meaning}</span>
            {term.translation && (
              <span className="mt-2 flex items-center gap-1.5 rounded-xl bg-kind-study-guide-vivid/10 px-2.5 py-1.5 text-sm">
                <Translate weight="bold" className="size-4 shrink-0 text-kind-study-guide" aria-hidden />
                <span>
                  {label}: <b>{term.translation}</b>
                </span>
              </span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
