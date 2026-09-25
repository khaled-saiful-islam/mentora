import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle, CircleNotch, XCircle } from '@phosphor-icons/react'
import { Input } from '@/components/ui'
import { apiFetch } from '@/lib/api'
import { pop, spring } from '@/motion'

interface Status {
  available: boolean
  reason: string | null
  suggestions: string[]
}

type Check = { state: 'idle' | 'checking' } | ({ state: 'done' } & Status)

const DEBOUNCE_MS = 350

/**
 * A username box that says, as you type, whether the name is free — and if
 * it is not, offers a few that are. A dead end at signup loses a student.
 */
export function UsernameField({
  value,
  onChange,
  onValidity,
  onFocus,
  onBlur,
}: {
  value: string
  onChange: (value: string) => void
  onValidity: (ok: boolean) => void
  onFocus?: () => void
  onBlur?: () => void
}) {
  const [check, setCheck] = useState<Check>({ state: 'idle' })

  useEffect(() => {
    const name = value.trim()
    onValidity(false)
    if (name.length < 2) {
      setCheck({ state: 'idle' })
      return
    }
    setCheck({ state: 'checking' })
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      apiFetch<Status>(`/auth/username-available?u=${encodeURIComponent(name)}`, {
        signal: controller.signal,
      })
        .then((status) => {
          setCheck({ state: 'done', ...status })
          onValidity(status.available)
        })
        .catch(() => {
          // Could not check: let the server decide on submit instead.
          if (!controller.signal.aborted) {
            setCheck({ state: 'idle' })
            onValidity(true)
          }
        })
    }, DEBOUNCE_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
    // onValidity is a setter from the parent; re-running on its identity would loop.
  }, [value])

  const done = check.state === 'done' ? check : null
  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={64}
          required
          placeholder="e.g. adam_5b"
          aria-invalid={done ? !done.available : undefined}
          aria-describedby="username-status"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="pr-12"
        />
        <span className="absolute inset-y-0 right-3 grid place-items-center" aria-hidden>
          <AnimatePresence mode="wait" initial={false}>
            {check.state === 'checking' && (
              <motion.span key="checking" {...fade}>
                <CircleNotch weight="bold" className="size-5 animate-spin text-muted-foreground" />
              </motion.span>
            )}
            {done?.available && (
              <motion.span key="ok" variants={pop} initial="hidden" animate="shown" exit="hidden">
                <CheckCircle weight="fill" className="size-6 text-correct" />
              </motion.span>
            )}
            {done && !done.available && (
              <motion.span key="no" variants={pop} initial="hidden" animate="shown" exit="hidden">
                <XCircle weight="fill" className="size-6 text-wrong" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>

      <div id="username-status" aria-live="polite" className="min-h-5 text-sm">
        {done?.available && <p className="font-semibold text-success">Nice — that one's yours!</p>}
        {done && !done.available && (
          <div className="space-y-2">
            <p className="font-semibold text-destructive">{done.reason}</p>
            {done.suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Try:</span>
                {done.suggestions.map((suggestion, i) => (
                  <motion.button
                    key={suggestion}
                    type="button"
                    onClick={() => onChange(suggestion)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring.bouncy, delay: i * 0.06 }}
                    whileTap={{ scale: 0.92 }}
                    className="rounded-full border-2 border-grape-200 bg-grape-50 px-3 py-1 font-bold text-grape-700 hover:border-grape-400 dark:border-grape-700 dark:bg-grape-900/40 dark:text-grape-200"
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        )}
        {check.state === 'idle' && value.trim().length < 2 && (
          <p className="text-muted-foreground">Letters, numbers, dots, dashes and underscores.</p>
        )}
      </div>
    </div>
  )
}

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}
