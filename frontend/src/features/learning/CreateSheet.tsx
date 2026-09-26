import { useEffect, useState } from 'react'
import { VoiceInput } from '@/features/voice/VoiceInput'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Globe, Minus, Plus, Sparkle, WarningCircle } from '@phosphor-icons/react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { Dialog } from '@/components/ui/Dialog'
import { useGrades } from '@/features/auth/useGrades'
import { errorMessage } from '@/features/auth/errors'
import { SUBJECTS } from '@/features/classes/subjects'
import { useMakeable } from '@/hooks/useMakeable'
import { useAuth } from '@/lib/auth'
import { spring } from '@/motion'
import { cn } from '@/lib/utils'
import { learningApi, type LearningKindName, type SetSummary } from './api'
import { LOOKS } from './kinds'
import { LEARN_SCENES } from './scenes'

const EXAMPLES = [
  'Photosynthesis',
  'Adding fractions',
  'The water cycle',
  'Kesultanan Melayu Melaka',
  'Parts of speech',
  'The solar system',
  'Food chains',
  'Simple machines',
]

const SELECT =
  'h-12 w-full rounded-2xl border-2 border-input bg-surface px-3 font-semibold focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'zh', label: '中文' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'bn', label: 'বাংলা' },
]

/**
 * What to make, in five choices: kind, topic, subject, grade, how many.
 * Everything but the topic has a sensible default.
 *
 * Three steps down the sheet, each with room around it: what to make (each
 * kind a small moving picture of itself), what it is about, and the details.
 */
export function CreateSheet({
  kind,
  initialTopic = '',
  onKind,
  onClose,
  onStarted,
}: {
  kind: LearningKindName | null
  /** What the topic starts as when the sheet opens — an example picked. */
  initialTopic?: string
  onKind: (kind: LearningKindName) => void
  onClose: () => void
  onStarted: (set: SetSummary) => void
}) {
  const { user } = useAuth()
  const makeable = useMakeable()
  const { grades } = useGrades()
  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [count, setCount] = useState(10)
  const [language, setLanguage] = useState('en')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const example = useRotating(EXAMPLES, kind !== null)
  const open = kind !== null
  // On opening only: switching kind inside the sheet keeps what was typed.
  useEffect(() => {
    if (open && initialTopic) setTopic(initialTopic)
  }, [open, initialTopic])
  const info = makeable.learning.find((k) => k.name === kind)
  const practice = info?.purpose === 'practice'

  useEffect(() => {
    if (kind === null) return
    setError(null)
    setGrade((g) => g || user?.grade_level || '')
    setCount(info?.default_count ?? 10)
  }, [kind, info?.default_count, user?.grade_level])

  async function start(event: React.FormEvent) {
    event.preventDefault()
    if (!kind) return
    setBusy(true)
    setError(null)
    try {
      const set = await learningApi.generate({ kind, topic, subject: subject || null, grade_level: grade || null, count, language })
      setTopic('')
      onStarted(set)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const max = info?.max_count ?? 30
  const kinds = (Object.keys(LOOKS) as LearningKindName[]).filter((name) => makeable.learning.some((k) => k.name === name))
  return (
    <Dialog
      open={kind !== null}
      onClose={onClose}
      title={practice ? 'Make a practice set' : 'Make something to learn'}
      description={practice ? 'Just for you — practise any topic you like.' : 'Grounded in trusted sources, ready to edit before you share.'}
      size="lg"
    >
      <form onSubmit={start} className="space-y-6">
        <section aria-labelledby="learn-kind-label">
          <p id="learn-kind-label" className="mb-2 text-sm font-bold text-foreground/85">What to make</p>
          <div className={cn('grid gap-3', kinds.length > 2 ? 'grid-cols-3' : 'grid-cols-2')} role="radiogroup" aria-labelledby="learn-kind-label">
            {kinds.map((name) => (
              <KindChoice key={name} name={name} on={kind === name} onPick={() => onKind(name)} />
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {kind && (
              <motion.p
                key={kind}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="mt-2.5 text-sm text-muted-foreground"
              >
                {LOOKS[kind].promise}
              </motion.p>
            )}
          </AnimatePresence>
        </section>

        <Field label="What's it about?" htmlFor="learn-topic">
          <VoiceInput
            id="learn-topic"
            required
            maxLength={200}
            autoFocus
            placeholder={`e.g. ${example}`}
            value={topic}
            onChange={setTopic}
            inputClassName="text-lg"
          />
        </Field>

        <fieldset className="grid gap-x-4 gap-y-4 rounded-3xl bg-muted/50 p-4 sm:grid-cols-2">
          <legend className="sr-only">Details</legend>
          <Field label="Subject" htmlFor="learn-subject">
            <Input id="learn-subject" list="learn-subjects" maxLength={80} placeholder="Any subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <datalist id="learn-subjects">
              {SUBJECTS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Grade" htmlFor="learn-grade">
            <select id="learn-grade" value={grade} onChange={(e) => setGrade(e.target.value)} className={SELECT}>
              <option value="">Any level</option>
              {grades.map((g) => (
                <option key={g.code} value={g.code}>{g.label}</option>
              ))}
            </select>
          </Field>
          <div className="space-y-1.5">
            {/* Laid out exactly like a Field's label, so the rows line up. */}
            <span id="learn-count-label" className="select-none text-sm font-bold text-foreground/85">
              How many {info?.item_noun_plural ?? 'questions'}
            </span>
            <Stepper labelledBy="learn-count-label" value={count} min={1} max={max} onChange={setCount} />
          </div>
          <Field label="Language" htmlFor="learn-language">
            <select id="learn-language" value={language} onChange={(e) => setLanguage(e.target.value)} className={SELECT}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </Field>
        </fieldset>

        {error && <Alert>{error}</Alert>}

        <div className="space-y-3">
          <Button type="submit" size="lg" variant="sun" className="w-full" loading={busy} disabled={topic.trim().length < 2 || !kind}>
            {!busy && <Sparkle weight="fill" className="size-5" />}
            Make my {info?.label.toLowerCase() ?? 'set'}
          </Button>
          <p className={cn('flex items-start justify-center gap-1.5 text-center text-sm', makeable.grounded ? 'text-muted-foreground' : 'text-sun-600 dark:text-sun-300')}>
            {makeable.grounded ? <Globe weight="duotone" className="mt-0.5 size-4 shrink-0" aria-hidden /> : <WarningCircle weight="duotone" className="mt-0.5 size-4 shrink-0" aria-hidden />}
            {makeable.grounded
              ? 'Checked against trusted sources — each answer shows where it came from.'
              : "Web search isn't set up, so this is written from general knowledge — check it carefully."}
          </p>
        </div>
      </form>
    </Dialog>
  )
}

/** One kind to make: a little moving picture of it, and its name — whole. */
function KindChoice({ name, on, onPick }: { name: LearningKindName; on: boolean; onPick: () => void }) {
  const look = LOOKS[name]
  const Scene = LEARN_SCENES[name]
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      className={cn(
        'group relative flex min-w-0 flex-col overflow-hidden rounded-3xl border-2 bg-surface p-1.5 text-left transition-[border-color,box-shadow] duration-200',
        on ? cn(look.ring, 'shadow-[0_14px_30px_-18px_currentColor]', look.text) : 'border-border hover:border-hover-border',
      )}
    >
      <span aria-hidden className={cn('relative grid h-20 place-items-center overflow-hidden rounded-[1.1rem] transition-opacity duration-200', look.hero, !on && 'opacity-80 group-hover:opacity-100')}>
        <Scene />
        <AnimatePresence>
          {on && (
            <motion.span
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={spring.bouncy}
              className={cn('absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-white shadow', look.text)}
            >
              <Check weight="bold" className="size-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="flex items-center justify-center gap-1.5 px-1 pb-1.5 pt-2.5 text-center">
        <look.Icon weight="duotone" className={cn('hidden size-5 shrink-0 sm:block', look.text)} aria-hidden />
        <span className={cn('min-w-0 break-words font-display text-base font-semibold leading-tight sm:text-lg', on ? look.text : 'text-foreground')}>{look.label}</span>
      </span>
    </motion.button>
  )
}

function Stepper({ labelledBy, value, min, max, onChange }: { labelledBy: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex h-12 items-center justify-between rounded-2xl border-2 border-input bg-surface px-1.5">
      <button type="button" aria-label="Fewer" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className="grid size-9 place-items-center rounded-xl hover:bg-hover disabled:opacity-30">
        <Minus weight="bold" className="size-4" />
      </button>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} className="font-display text-xl font-semibold tabular-nums" aria-live="polite">
          {value}
        </motion.span>
      </AnimatePresence>
      <button type="button" aria-label="More" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className="grid size-9 place-items-center rounded-xl hover:bg-hover disabled:opacity-30">
        <Plus weight="bold" className="size-4" />
      </button>
    </div>
  )
}

/** Cycle through examples while the sheet is open, for a placeholder that suggests. */
function useRotating(values: string[], active: boolean): string {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % values.length), 2600)
    return () => window.clearInterval(timer)
  }, [active, values.length])
  return values[index]
}
