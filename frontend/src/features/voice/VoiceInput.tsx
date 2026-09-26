/**
 * A text box you can also talk into. Tap the mic, say it, tap again: the
 * words appear in the box to read, fix and send — so a student who finds
 * typing slow can still ask, and always sees exactly what will be sent.
 */
import { Microphone, Stop } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useCalmMotion } from '@/motion'
import { useRecorder } from './useRecorder'

export async function transcribe(wav: Blob): Promise<string> {
  const form = new FormData()
  form.append('clip', wav, 'speech.wav')
  return (await apiFetch<{ text: string }>('/voice/transcribe', { method: 'POST', body: form })).text
}

const TONES = {
  // On Astra's night sky: always dark words on a white box.
  dark: 'border-white/30 bg-white text-grape-900 placeholder:text-grape-400 caret-grape-900 focus-within:ring-sun-400',
  light: 'border-border bg-surface text-foreground placeholder:text-muted-foreground focus-within:ring-ring/40',
} as const

export function VoiceInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  maxLength = 400,
  multiline = false,
  tone = 'light',
  autoFocus,
  required,
  inputClassName,
  onEnter,
  className,
}: {
  id: string
  /** Leave out when a visible <label for={id}> already names the box. */
  label?: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  maxLength?: number
  multiline?: boolean
  tone?: keyof typeof TONES
  autoFocus?: boolean
  required?: boolean
  inputClassName?: string
  /** Enter sends (single-line boxes). */
  onEnter?: () => void
  className?: string
}) {
  const calm = useCalmMotion()
  const box = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const recorder = useRecorder(async (wav) => {
    setProblem(null)
    try {
      const heard = await transcribe(wav)
      const joined = value.trim() ? `${value.trim()} ${heard}` : heard
      onChange(joined.slice(0, maxLength))
      box.current?.focus()
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That couldn't be heard. Try again, or type it.")
    }
  })
  const listening = recorder.state === 'listening'
  const working = recorder.state === 'working'
  const Field = multiline ? 'textarea' : 'input'

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      )}
      <div className={cn('flex items-start gap-2 rounded-2xl border-2 p-1.5 pl-3 ring-offset-0 focus-within:ring-4', TONES[tone])}>
        <Field
          ref={box}
          id={id}
          value={value}
          maxLength={maxLength}
          autoFocus={autoFocus}
          required={required}
          rows={multiline ? 3 : undefined}
          placeholder={listening ? 'Listening…' : working ? 'Writing down what you said…' : placeholder}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (!multiline && e.key === 'Enter' && onEnter) {
              e.preventDefault()
              onEnter()
            }
          }}
          className={cn('min-w-0 flex-1 resize-none bg-transparent py-2 text-base font-semibold outline-none', multiline && 'min-h-[4.5rem]', inputClassName)}
        />
        {recorder.state !== 'unsupported' && (
          <motion.button
            type="button"
            onClick={() => void recorder.toggle()}
            disabled={working}
            aria-label={listening ? 'Stop and write it down' : 'Say it instead of typing'}
            aria-pressed={listening}
            animate={listening && !calm ? { scale: 1 + recorder.level * 0.35 } : { scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className={cn(
              'relative grid size-11 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-60',
              listening ? 'bg-coral-400 text-white' : 'bg-kind-live-vivid text-white hover:brightness-110',
            )}
          >
            <AnimatePresence>
              {listening && !calm && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-coral-400"
                  initial={{ opacity: 0.5, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.8 }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
              )}
            </AnimatePresence>
            {listening ? <Stop weight="fill" className="relative size-5" aria-hidden /> : <Microphone weight="fill" className="relative size-5" aria-hidden />}
          </motion.button>
        )}
      </div>
      {(problem || recorder.state === 'denied') && (
        <p className={cn('text-sm font-semibold', tone === 'dark' ? 'text-sun-300' : 'text-destructive')}>
          {recorder.state === 'denied' ? 'The microphone is off for this site. You can still type.' : problem}
        </p>
      )}
    </div>
  )
}
