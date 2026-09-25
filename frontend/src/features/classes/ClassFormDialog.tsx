import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Check } from '@phosphor-icons/react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { Dialog } from '@/components/ui/Dialog'
import { useGrades } from '@/features/auth/useGrades'
import { errorMessage } from '@/features/auth/errors'
import { spring } from '@/motion'
import { THEME_KEYS, THEMES, type ThemeKey } from '@/lib/palette'
import { cn } from '@/lib/utils'
import type { ClassDraft, ClassRoom } from './api'
import { SUBJECTS } from './subjects'

/** Make a class, or change one. The preview card updates as you type. */
export function ClassFormDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial?: ClassRoom | null
  onClose: () => void
  onSave: (draft: ClassDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState<Required<ClassDraft>>(blank(initial))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { grades } = useGrades()

  useEffect(() => {
    if (open) {
      setDraft(blank(initial))
      setError(null)
    }
  }, [open, initial])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave({ ...draft, subject: draft.subject || null, grade_level: draft.grade_level || null })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const look = THEMES[draft.theme]
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit class' : 'New class'}
      description={initial ? undefined : "You'll get an invite link and a class code right away."}
    >
      <form id="class-form" onSubmit={submit} className="space-y-5">
        <motion.div
          layout
          className={cn('rounded-3xl p-5 shadow-press', look.hero, look.onHero)}
          transition={spring.gentle}
        >
          <p className="text-sm font-bold opacity-80">{draft.subject || 'Subject'}</p>
          <p className="break-words font-display text-2xl font-semibold">{draft.name || 'Class name'}</p>
        </motion.div>

        <Field label="Class name" htmlFor="class-name">
          <Input
            id="class-name"
            required
            maxLength={120}
            autoFocus
            placeholder="e.g. 5 Bestari"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Subject" htmlFor="class-subject">
            <Input
              id="class-subject"
              list="subject-options"
              maxLength={80}
              placeholder="e.g. Science"
              value={draft.subject ?? ''}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            />
            <datalist id="subject-options">
              {SUBJECTS.map((subject) => (
                <option key={subject} value={subject} />
              ))}
            </datalist>
          </Field>
          <Field label="Grade" htmlFor="class-grade">
            <select
              id="class-grade"
              value={draft.grade_level ?? ''}
              onChange={(e) => setDraft({ ...draft, grade_level: e.target.value })}
              className="h-12 w-full rounded-2xl border-2 border-input bg-surface px-3 font-semibold focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              <option value="">Mixed / not set</option>
              {grades.map((grade) => (
                <option key={grade.code} value={grade.code}>
                  {grade.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-bold text-foreground/85">Colour</legend>
          <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Class colour">
            {THEME_KEYS.map((key) => (
              <Swatch key={key} themeKey={key} on={draft.theme === key} onPick={() => setDraft({ ...draft, theme: key })} />
            ))}
          </div>
        </fieldset>

        {error && <Alert>{error}</Alert>}
      </form>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="class-form" loading={busy}>
          {initial ? 'Save' : 'Create class'}
        </Button>
      </div>
    </Dialog>
  )
}

function Swatch({ themeKey, on, onPick }: { themeKey: ThemeKey; on: boolean; onPick: () => void }) {
  const look = THEMES[themeKey]
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={look.label}
      title={look.label}
      onClick={onPick}
      whileTap={{ scale: 0.85 }}
      animate={{ scale: on ? 1.12 : 1 }}
      transition={spring.bouncy}
      className={cn(
        'grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-surface',
        look.hero,
        look.onHero,
        on && 'ring-4 ring-primary/40',
      )}
    >
      {on && <Check weight="bold" className="size-5" />}
    </motion.button>
  )
}

function blank(initial?: ClassRoom | null): Required<ClassDraft> {
  return {
    name: initial?.name ?? '',
    subject: initial?.subject ?? '',
    grade_level: initial?.grade_level ?? '',
    description: initial?.description ?? '',
    theme: initial?.theme ?? 'grape',
  }
}
