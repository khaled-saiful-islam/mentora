import { useRef } from 'react'
import { motion } from 'motion/react'
import { spring } from '@/motion'
import { cn } from '@/lib/utils'

const LENGTH = 6
const ALLOWED = /[ABCDEFGHJKMNPQRSTUVWXYZ23456789]/

/**
 * Six boxes for a class code, one letter each. Typing moves on, Backspace
 * moves back, and pasting a whole code fills every box.
 */
export function CodeInput({ value, onChange, invalid }: { value: string; onChange: (code: string) => void; invalid?: boolean }) {
  const boxes = useRef<(HTMLInputElement | null)[]>([])
  const letters = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '')

  function clean(raw: string): string {
    return raw.toUpperCase().split('').filter((c) => ALLOWED.test(c)).join('')
  }

  function put(index: number, raw: string) {
    const typed = clean(raw)
    if (!typed) return
    const next = (value.slice(0, index) + typed).slice(0, LENGTH)
    onChange(next)
    boxes.current[Math.min(next.length, LENGTH - 1)]?.focus()
  }

  function onKey(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      const at = letters[index] ? index : Math.max(0, index - 1)
      onChange(value.slice(0, at))
      boxes.current[at]?.focus()
    } else if (event.key === 'ArrowLeft') boxes.current[index - 1]?.focus()
    else if (event.key === 'ArrowRight') boxes.current[index + 1]?.focus()
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Class code">
      {letters.map((letter, index) => (
        <motion.input
          key={index}
          ref={(el) => {
            boxes.current[index] = el
          }}
          value={letter}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={LENGTH}
          aria-label={`Letter ${index + 1}`}
          aria-invalid={invalid || undefined}
          onChange={(e) => put(index, e.target.value)}
          onKeyDown={(e) => onKey(index, e)}
          onFocus={(e) => e.target.select()}
          animate={letter ? { scale: [1, 1.12, 1] } : { scale: 1 }}
          transition={spring.bouncy}
          className={cn(
            'size-12 rounded-xl border-2 bg-surface text-center font-display text-2xl font-semibold uppercase sm:size-14',
            'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
            invalid ? 'border-wrong' : letter ? 'border-grape-300' : 'border-input',
          )}
        />
      ))}
    </div>
  )
}
