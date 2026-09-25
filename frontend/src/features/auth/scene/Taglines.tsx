import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useCalmMotion } from '@/motion'

const TYPE_MS = 55
const ERASE_MS = 26
const HOLD_MS = 1900
const GAP_MS = 320
/** With motion reduced: no typing, one line after another. */
const CALM_MS = 3400

/**
 * One line at a time, typed out and rubbed out again, with a caret.
 * A screen reader hears every line once instead of a letter at a time.
 */
export function Taglines({ lines, className }: { lines: readonly string[]; className?: string }) {
  const calm = useCalmMotion()
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState(0)
  const [erasing, setErasing] = useState(false)
  const line = lines[index % lines.length] ?? ''

  useEffect(() => {
    if (calm) {
      setTyped(line.length)
      const at = window.setTimeout(() => setIndex((i) => i + 1), CALM_MS)
      return () => window.clearTimeout(at)
    }
    const full = typed >= line.length
    const empty = typed <= 0
    const wait = erasing ? (empty ? GAP_MS : ERASE_MS) : full ? HOLD_MS : TYPE_MS
    const at = window.setTimeout(() => {
      if (!erasing && full) setErasing(true)
      else if (erasing && empty) {
        setErasing(false)
        setIndex((i) => i + 1)
      } else setTyped((n) => n + (erasing ? -1 : 1))
    }, wait)
    return () => window.clearTimeout(at)
  }, [calm, typed, erasing, line])

  return (
    <p className={cn('min-h-[1.5em]', className)}>
      <span className="sr-only">{lines.join(' ')}</span>
      <span aria-hidden>
        {line.slice(0, typed)}
        <motion.span
          className="ml-0.5 inline-block h-[1em] w-[3px] translate-y-[0.15em] rounded-full bg-sun-300"
          animate={calm ? { opacity: 1 } : { opacity: [1, 0, 1] }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
      </span>
    </p>
  )
}
