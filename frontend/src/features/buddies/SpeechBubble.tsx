import { motion } from 'motion/react'
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { placeBubble, type Placement } from './bubblePlace'

export type BubbleSide = 'top' | 'right' | 'left' | 'above-left'

const TAIL: Record<Placement['tail'], string> = {
  bottom: '-bottom-[7px] -translate-x-1/2 rotate-45 border-b-2 border-r-2',
  top: '-top-[7px] -translate-x-1/2 rotate-45 border-t-2 border-l-2',
  left: '-left-[7px] -translate-y-1/2 rotate-45 border-b-2 border-l-2',
  right: '-right-[7px] -translate-y-1/2 rotate-45 border-t-2 border-r-2',
}

const ORIGIN: Record<Placement['tail'], string> = {
  bottom: 'origin-bottom',
  top: 'origin-top',
  left: 'origin-left',
  right: 'origin-right',
}

/**
 * What a buddy says: a bubble that pops out of them, words landing one at a
 * time as if spoken.
 *
 * It is drawn over the whole page, beside its buddy (`anchor`), so no card
 * that clips its contents and no screen edge can cut it off
 * (`bubblePlace.ts`). It follows its buddy through a scroll or a resize.
 */
export function SpeechBubble({
  text,
  side = 'top',
  anchor,
  className,
}: {
  text: string
  side?: BubbleSide
  anchor: React.RefObject<HTMLElement | null>
  className?: string
}) {
  const bubble = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<Placement | null>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const buddy = anchor.current?.getBoundingClientRect()
      const own = bubble.current
      if (!buddy || !own) return
      setPlace(
        placeBubble(
          { left: buddy.left, top: buddy.top, width: buddy.width, height: buddy.height },
          { width: own.offsetWidth, height: own.offsetHeight },
          { width: window.innerWidth, height: window.innerHeight },
          side,
        ),
      )
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [anchor, side, text])

  const words = text.split(/\s+/)
  const tail = place?.tail ?? 'bottom'
  return createPortal(
    <motion.div
      ref={bubble}
      key={text}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={place ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 460, damping: 22 }}
      style={{ left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? 'visible' : 'hidden' }}
      className={cn(
        // Never wider than the screen allows; long words break rather than spill.
        'pointer-events-none fixed z-[70] w-max max-w-[min(15rem,calc(100vw-1.5rem))] rounded-2xl border-2 border-border bg-surface px-4 py-2.5 break-words',
        'font-display text-base leading-snug font-medium text-surface-foreground shadow-lg',
        ORIGIN[tail],
        className,
      )}
    >
      <motion.span
        className="relative z-10 block"
        initial="hidden"
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.045, delayChildren: 0.08 } } }}
      >
        {words.map((word, i) => (
          // The space goes between the words, not inside one: a space at the
          // end of an inline-block is dropped, and the words run together.
          <Fragment key={`${word}-${i}`}>
            <motion.span
              className="inline-block max-w-full"
              variants={{ hidden: { opacity: 0, y: 6, scale: 0.8 }, shown: { opacity: 1, y: 0, scale: 1 } }}
              transition={{ type: 'spring', stiffness: 520, damping: 24 }}
            >
              {word}
            </motion.span>
            {i < words.length - 1 && ' '}
          </Fragment>
        ))}
      </motion.span>
      <span
        aria-hidden
        className={cn('absolute size-3 border-border bg-surface', TAIL[tail])}
        style={tail === 'top' || tail === 'bottom' ? { left: place?.tailAt ?? 24 } : { top: place?.tailAt ?? 24 }}
      />
    </motion.div>,
    document.body,
  )
}
