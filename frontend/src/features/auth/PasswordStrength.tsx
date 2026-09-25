import { motion } from 'motion/react'
import { spring } from '@/motion'
import { cn } from '@/lib/utils'

/** A rough guide, not a rule: length first, then variety. */
export function strengthOf(password: string): 0 | 1 | 2 | 3 {
  if (password.length < 8) return 0
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length
  if (password.length >= 14 || (password.length >= 10 && kinds >= 3)) return 3
  if (password.length >= 10 || kinds >= 2) return 2
  return 1
}

const WORDS = ['At least 8 characters', 'Okay', 'Good', 'Strong!'] as const
const TONES = ['bg-border', 'bg-coral-400', 'bg-sun-400', 'bg-correct'] as const

export function PasswordStrength({ password }: { password: string }) {
  const score = strengthOf(password)
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1.5" aria-hidden>
        {[1, 2, 3].map((bar) => (
          <span key={bar} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.span
              className={cn('block h-full rounded-full', TONES[score])}
              initial={false}
              animate={{ width: score >= bar ? '100%' : '0%' }}
              transition={spring.gentle}
            />
          </span>
        ))}
      </div>
      <span className="w-40 text-right text-sm" aria-live="polite">
        {WORDS[score]}
      </span>
    </div>
  )
}
