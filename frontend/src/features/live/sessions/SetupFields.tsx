/**
 * The pieces of a live lesson's setup, one step each. Plain controlled
 * inputs: the page holds the settings, each step edits its part of them.
 */
import { ArrowDown, ArrowUp, Plus, Sparkle, Trash, UsersThree } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { Segmented } from '@/components/ui/Segmented'
import { useGrades } from '@/features/auth/useGrades'
import type { ClassRoom, Group } from '@/features/classes/api'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { APPROACHES, DURATIONS, type Difficulty, type SessionSettings } from './api'

export type Patch = (patch: Partial<SessionSettings>) => void

const SELECT = 'w-full rounded-xl border-2 border-border bg-surface px-3 py-2 font-semibold'
const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export function WhoStep({
  classes,
  groups,
  classId,
  groupId,
  onClass,
  onGroup,
}: {
  classes: ClassRoom[]
  groups: Group[] | null
  classId: string
  groupId: string
  onClass: (id: string) => void
  onGroup: (id: string) => void
}) {
  if (classes.length === 0) {
    return <Alert tone="info">Make a class and a group in it first — a live lesson is for one group.</Alert>
  }
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 font-bold">Which class?</h3>
        <div role="radiogroup" aria-label="Class" className={cn('grid gap-2', classes.length > 1 && 'sm:grid-cols-2')}>
          {classes.map((room) => (
            <Choice key={room.id} on={room.id === classId} onClick={() => onClass(room.id)}>
              <span className="block break-words font-bold">{room.name}</span>
              <span className="text-sm text-muted-foreground">
                {room.students} students · {room.groups} group{room.groups === 1 ? '' : 's'}
              </span>
            </Choice>
          ))}
        </div>
      </div>
      {classId && (
        <div>
          <h3 className="mb-3 font-bold">Which group?</h3>
          {groups === null ? (
            <p className="text-muted-foreground">Loading the groups…</p>
          ) : groups.length === 0 ? (
            <Alert tone="info">This class has no groups yet. Make one on the class page, then come back.</Alert>
          ) : (
            <div role="radiogroup" aria-label="Group" className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <Choice key={g.id} on={g.id === groupId} onClick={() => onGroup(g.id)} compact>
                  <UsersThree weight="bold" className="size-4 shrink-0" aria-hidden />
                  <span className="break-words font-bold">{g.name}</span>
                  <span className="text-sm text-muted-foreground">· {g.member_ids.length}</span>
                </Choice>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function WhatStep({
  settings,
  patch,
  suggest,
}: {
  settings: SessionSettings
  patch: Patch
  suggest: () => Promise<string[]>
}) {
  const { groups } = useGrades()
  const [suggesting, setSuggesting] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const parts = settings.breakdown
  // A stable key per part, so removing one animates only that one and typing
  // never remounts the box being typed in.
  const [ids, setIds] = useState<number[]>(() => parts.map((_, i) => i))
  const serial = useRef(parts.length)
  const keys = ids.length === parts.length ? ids : parts.map((_, i) => i + 10_000 * serial.current)
  const setParts = (next: string[], nextKeys: number[] = next.map((_, i) => keys[i] ?? (serial.current += 1))) => {
    setIds(nextKeys)
    patch({ breakdown: next })
  }
  const ask = async () => {
    setSuggesting(true)
    setProblem(null)
    try {
      const made = await suggest()
      if (made.length) setParts(made, made.map(() => (serial.current += 1)))
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Parts could not be suggested just now.')
    } finally {
      setSuggesting(false)
    }
  }
  const canSuggest = settings.subject.trim().length > 0 && settings.topic.trim().length > 1

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Subject" htmlFor="live-subject">
          <Input id="live-subject" value={settings.subject} maxLength={80} placeholder="Science" onChange={(e) => patch({ subject: e.target.value })} />
        </Field>
        <Field label="School level" htmlFor="live-grade">
          <select id="live-grade" className={SELECT} value={settings.grade_level} onChange={(e) => patch({ grade_level: e.target.value })}>
            {groups.map((group) => (
              <optgroup key={group.stage} label={group.stage}>
                {group.grades.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Topic" htmlFor="live-topic">
        <Input id="live-topic" value={settings.topic} maxLength={160} placeholder="How plants make their food" onChange={(e) => patch({ topic: e.target.value })} />
      </Field>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-[min(100%,14rem)] flex-1">
            <h3 className="font-bold">The parts, in order</h3>
            <p className="text-sm text-muted-foreground">Astra teaches them one by one. Edit, reorder or add your own.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void ask()} disabled={!canSuggest || suggesting}>
            <Sparkle weight="fill" className="size-4" aria-hidden />
            {suggesting ? 'Thinking…' : parts.length ? 'Suggest again' : 'Suggest parts'}
          </Button>
        </div>
        {problem && <Alert className="mb-2">{problem}</Alert>}
        <ol className="space-y-2">
          <AnimatePresence initial={false}>
            {parts.map((part, i) => (
              <motion.li
                key={keys[i]}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={spring.gentle}
                className="flex items-center gap-2 rounded-2xl border-2 border-border bg-surface p-2"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-kind-live-vivid font-bold text-white">{i + 1}</span>
                <Input
                  aria-label={`Part ${i + 1}`}
                  value={part}
                  maxLength={120}
                  onChange={(e) => setParts(parts.map((p, n) => (n === i ? e.target.value : p)), keys)}
                  className="min-w-0 flex-1 border-0 bg-transparent"
                />
                <IconButton label={`Move part ${i + 1} up`} disabled={i === 0} onClick={() => setParts(move(parts, i, -1), move(keys, i, -1))}>
                  <ArrowUp weight="bold" className="size-4" />
                </IconButton>
                <IconButton label={`Move part ${i + 1} down`} disabled={i === parts.length - 1} onClick={() => setParts(move(parts, i, 1), move(keys, i, 1))}>
                  <ArrowDown weight="bold" className="size-4" />
                </IconButton>
                <IconButton label={`Remove part ${i + 1}`} onClick={() => setParts(parts.filter((_, n) => n !== i), keys.filter((_, n) => n !== i))}>
                  <Trash weight="bold" className="size-4" />
                </IconButton>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
        {parts.length < 12 && (
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setParts([...parts, ''], [...keys, (serial.current += 1)])}>
            <Plus weight="bold" className="size-4" aria-hidden />
            Add a part
          </Button>
        )}
      </div>
    </div>
  )
}

export function HowStep({
  settings,
  patch,
  voices,
}: {
  settings: SessionSettings
  patch: Patch
  voices: { id: string; label: string }[]
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 font-bold">How should Astra teach it?</h3>
        <div role="radiogroup" aria-label="Teaching approach" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {APPROACHES.map((a) => (
            <Choice key={a.value} on={settings.approach === a.value} onClick={() => patch({ approach: a.value })}>
              <span className="block font-bold">{a.label}</span>
              <span className="text-sm text-muted-foreground">{a.blurb}</span>
            </Choice>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <div>
          <h3 className="mb-2 font-bold">Level</h3>
          <Segmented label="Level" options={DIFFICULTIES} value={settings.difficulty} onChange={(difficulty) => patch({ difficulty })} />
        </div>
        <div>
          <h3 className="mb-2 font-bold">How long</h3>
          <div role="radiogroup" aria-label="Length in minutes" className="flex flex-wrap gap-2">
            {DURATIONS.map((m) => (
              <Choice key={m} on={settings.duration_minutes === m} onClick={() => patch({ duration_minutes: m })} compact>
                <span className="font-bold">{m} min</span>
              </Choice>
            ))}
          </div>
        </div>
      </div>
      <Field label="Anything else Astra should do? (optional)" htmlFor="live-extra" hint="For example: use the durian as the running example.">
        <textarea
          id="live-extra"
          rows={2}
          maxLength={400}
          value={settings.custom_instruction}
          onChange={(e) => patch({ custom_instruction: e.target.value })}
          className="w-full rounded-2xl border-2 border-border bg-surface px-3 py-2"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 font-bold">Questions</h3>
          <Segmented
            label="When students may ask"
            options={[
              { value: 'anytime', label: 'Any time' },
              { value: 'pauses', label: 'At pauses' },
            ]}
            value={settings.questions.mode}
            onChange={(mode) => patch({ questions: { ...settings.questions, mode } })}
          />
        </div>
        <Field label="Questions each student may ask" htmlFor="live-max">
          <Input
            id="live-max"
            type="number"
            min={1}
            max={10}
            value={settings.questions.max_per_student}
            onChange={(e) => patch({ questions: { ...settings.questions, max_per_student: clamp(Number(e.target.value), 1, 10) } })}
          />
        </Field>
      </div>
      {voices.length > 0 && (
        <div>
          <h3 className="mb-2 font-bold">Astra's voice</h3>
          <div role="radiogroup" aria-label="Voice" className="flex flex-wrap gap-2">
            {voices.map((v) => (
              <Choice key={v.id} on={(settings.voice.voice ?? voices[0].id) === v.id} onClick={() => patch({ voice: { ...settings.voice, voice: v.id } })} compact>
                <span className="font-bold">{v.label}</span>
              </Choice>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function AfterStep({
  settings,
  patch,
  template,
  onTemplate,
}: {
  settings: SessionSettings
  patch: Patch
  template: string | null
  onTemplate: (name: string | null) => void
}) {
  const quiz = settings.quiz
  return (
    <div className="space-y-6">
      <label className="flex items-start gap-3 rounded-2xl border-2 border-border bg-surface p-4">
        <input type="checkbox" className="mt-1 size-5 accent-[hsl(var(--kind-live-vivid))]" checked={quiz.enabled} onChange={(e) => patch({ quiz: { ...quiz, enabled: e.target.checked } })} />
        <span>
          <span className="block font-bold">A quiz afterwards</span>
          <span className="text-sm text-muted-foreground">Made from the lesson and the group's questions, and shared with them when it ends.</span>
        </span>
      </label>
      {quiz.enabled && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Questions" htmlFor="quiz-count">
            <Input id="quiz-count" type="number" min={3} max={20} value={quiz.count} onChange={(e) => patch({ quiz: { ...quiz, count: clamp(Number(e.target.value), 3, 20) } })} />
          </Field>
          <Field label="Level" htmlFor="quiz-level">
            <select id="quiz-level" className={SELECT} value={quiz.difficulty} onChange={(e) => patch({ quiz: { ...quiz, difficulty: e.target.value as Difficulty } })}>
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due (optional)" htmlFor="quiz-due">
            <Input
              id="quiz-due"
              type="datetime-local"
              value={quiz.due_at ? quiz.due_at.slice(0, 16) : ''}
              onChange={(e) => patch({ quiz: { ...quiz, due_at: e.target.value ? new Date(e.target.value).toISOString() : null } })}
            />
          </Field>
        </div>
      )}
      <label className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-border p-4">
        <input type="checkbox" className="mt-1 size-5 accent-[hsl(var(--kind-live-vivid))]" checked={template !== null} onChange={(e) => onTemplate(e.target.checked ? `${settings.subject} — ${settings.topic}`.trim() : null)} />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Save this setup as a template</span>
          {template !== null && (
            <Input aria-label="Template name" className="mt-2" value={template} maxLength={120} onChange={(e) => onTemplate(e.target.value)} />
          )}
        </span>
      </label>
    </div>
  )
}

function Choice({ on, onClick, compact, children }: { on: boolean; onClick: () => void; compact?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'rounded-2xl border-2 text-left transition-colors',
        compact ? 'inline-flex items-center gap-1.5 px-3.5 py-2' : 'p-3.5',
        on ? 'border-kind-live-vivid bg-kind-live-vivid/10 shadow-sm' : 'border-border bg-surface hover:border-kind-live-vivid/60',
      )}
    >
      {children}
    </button>
  )
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function move<T>(list: T[], index: number, by: number): T[] {
  const next = [...list]
  const [item] = next.splice(index, 1)
  next.splice(index + by, 0, item)
  return next
}

function clamp(value: number, low: number, high: number): number {
  return Number.isFinite(value) ? Math.min(high, Math.max(low, Math.round(value))) : low
}
