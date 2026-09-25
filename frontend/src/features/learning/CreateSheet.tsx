import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Globe, Minus, Plus, Sparkle, WarningCircle } from '@phosphor-icons/react'
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
 */
export function CreateSheet({
  kind,
  onKind,
  onClose,
  onStarted,
}: {
  kind: LearningKindName | null
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
  return (
    <Dialog
      open={kind !== null}
      onClose={onClose}
      title={practice ? 'Make a practice set' : 'Make something to learn'}
      description={practice ? 'Just for you — practise any topic you like.' : 'Grounded in trusted sources, ready to edit before you share.'}
      size="md"
    >
      <form onSubmit={start} className="space-y-5">
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="What to make">
          {(Object.keys(LOOKS) as LearningKindName[])
            .filter((name) => makeable.learning.some((k) => k.name === name))
            .map((name) => (
              <KindChoice key={name} name={name} on={kind === name} onPick={() => onKind(name)} />
            ))}
        </div>

        <Field label="Topic" htmlFor="learn-topic">
          <Input
            id="learn-topic"
            required
            minLength={2}
            maxLength={200}
            autoFocus
            placeholder={`e.g. ${example}`}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-14 text-lg"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject" htmlFor="learn-subject">
            <Input id="learn-subject" list="learn-subjects" maxLength={80} placeholder="Optional" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <datalist id="learn-subjects">
              {SUBJECTS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Grade" htmlFor="learn-grade">
            <select id="learn-grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="h-12 w-full rounded-2xl border-2 border-input bg-surface px-3 font-semibold focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
              <option value="">Any level</option>
              {grades.map((g) => (
                <option key={g.code} value={g.code}>{g.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-bold text-foreground/85">How many {info?.item_noun_plural ?? 'questions'}</p>
            <Stepper value={count} min={1} max={max} onChange={setCount} />
          </div>
          <Field label="Language" htmlFor="learn-language">
            <select id="learn-language" value={language} onChange={(e) => setLanguage(e.target.value)} className="h-12 w-full rounded-2xl border-2 border-input bg-surface px-3 font-semibold focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <p className={cn('flex items-start gap-2 rounded-2xl px-4 py-3 text-sm', makeable.grounded ? 'bg-sky-100 text-sky-700 dark:bg-sky-700/30 dark:text-sky-100' : 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300')}>
          {makeable.grounded ? <Globe weight="duotone" className="mt-0.5 size-5 shrink-0" /> : <WarningCircle weight="duotone" className="mt-0.5 size-5 shrink-0" />}
          {makeable.grounded
            ? "We'll search trusted sources, check every answer against them, and show you where each one came from."
            : "Web search isn't set up, so this will be written from general knowledge — check it carefully."}
        </p>

        {error && <Alert>{error}</Alert>}

        <Button type="submit" size="lg" variant="sun" className="w-full" loading={busy} disabled={topic.trim().length < 2 || !kind}>
          {!busy && <Sparkle weight="fill" className="size-5" />}
          Make my {info?.label.toLowerCase() ?? 'set'}
        </Button>
      </form>
    </Dialog>
  )
}

function KindChoice({ name, on, onPick }: { name: LearningKindName; on: boolean; onPick: () => void }) {
  const look = LOOKS[name]
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      whileTap={{ scale: 0.96 }}
      animate={{ scale: on ? 1.02 : 1 }}
      transition={spring.snappy}
      className={cn(
        'relative flex items-center gap-3 overflow-hidden rounded-3xl border-2 p-3 text-left transition-colors',
        on ? cn(look.hero, 'border-transparent shadow-press') : 'border-border bg-surface hover:border-hover-border',
      )}
    >
      <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', on ? 'bg-white/20 ring-1 ring-white/40' : cn(look.hero, 'shadow-press'))}>
        <look.Icon weight="duotone" className="size-7" />
      </span>
      <span className="font-display text-lg font-semibold">{look.label}</span>
    </motion.button>
  )
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex h-12 items-center justify-between rounded-2xl border-2 border-input bg-surface px-1.5">
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
