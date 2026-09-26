/**
 * Setting up a live lesson, in four small steps: who it is for, what it
 * teaches, how Astra teaches it, and what happens after. Creating it takes the
 * teacher to the lesson's own page, where the lesson is written and checked.
 *
 * `/live/:id/setup` opens the same steps to change a session already made.
 */
import { ArrowLeft, ArrowRight, Broadcast, Check, Lightbulb, ListChecks, Sparkle, UsersThree } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Card } from '@/components/ui'
import { classesApi, type ClassRoom, type Group } from '@/features/classes/api'
import { cn } from '@/lib/utils'
import { Page, rise, spring } from '@/motion'
import { getVoices } from '../api'
import { DEFAULT_SETTINGS, sessionsApi, type SessionSettings, type Template } from './api'
import { AfterStep, HowStep, WhatStep, WhoStep } from './SetupFields'

const STEPS = [
  { label: 'Who', Icon: UsersThree },
  { label: 'What', Icon: Lightbulb },
  { label: 'How', Icon: Broadcast },
  { label: 'After', Icon: ListChecks },
] as const

export default function SetupPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [step, setStep] = useState(editing ? 1 : 0)
  const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SETTINGS)
  const [classes, setClasses] = useState<ClassRoom[] | null>(null)
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [classId, setClassId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [saveAs, setSaveAs] = useState<string | null>(null)
  const [voices, setVoices] = useState<{ id: string; label: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    classesApi.list().then((r) => setClasses(r.items)).catch(() => setClasses([]))
    sessionsApi.templates().then((r) => setTemplates(r.items)).catch(() => undefined)
    getVoices()
      .then((o) => setVoices(o.voices.map((v) => ({ id: v, label: o.labels[v] ?? v }))))
      .catch(() => undefined)
    if (id) {
      sessionsApi
        .get(id)
        .then((s) => {
          setSettings({ ...DEFAULT_SETTINGS, ...s.settings })
          setClassId(s.class_id)
          setGroupId(s.group_id)
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'That session could not be opened.'))
    }
  }, [id])

  useEffect(() => {
    if (!classId) return
    setGroups(null)
    classesApi.groups(classId).then((r) => setGroups(r.items)).catch(() => setGroups([]))
  }, [classId])

  const patch = (next: Partial<SessionSettings>) => setSettings((s) => ({ ...s, ...next }))
  const cleanParts = useMemo(() => settings.breakdown.map((p) => p.trim()).filter(Boolean), [settings.breakdown])
  const ready = [
    Boolean(classId && groupId),
    settings.subject.trim().length > 0 && settings.topic.trim().length > 1 && cleanParts.length > 0,
    true,
    true,
  ]

  const finish = async () => {
    setBusy(true)
    setError(null)
    const final = { ...settings, breakdown: cleanParts }
    try {
      if (saveAs?.trim()) await sessionsApi.saveTemplate(saveAs.trim(), final)
      const made = id
        ? await sessionsApi.update(id, final)
        : await sessionsApi.create({ class_id: classId, group_id: groupId, settings: final, template_id: templateId })
      navigate(`/live/${made.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The lesson could not be saved.')
      setBusy(false)
    }
  }

  return (
    <Page className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <motion.header variants={rise} className="mb-6">
        <button type="button" onClick={() => navigate(id ? `/live/${id}` : '/live')} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft weight="bold" className="size-4" aria-hidden />
          {id ? 'Back to the lesson' : 'Live lessons'}
        </button>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{editing ? 'Change the setup' : 'New live lesson'}</h1>
      </motion.header>

      <Steps index={step} onPick={(n) => n <= step || ready.slice(0, n).every(Boolean) ? setStep(n) : undefined} skipFirst={editing} />

      {!editing && step === 0 && templates.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-muted-foreground">Start from a template:</span>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSettings({ ...DEFAULT_SETTINGS, ...t.settings })
                setTemplateId(t.id)
              }}
              className={cn(
                'rounded-full border-2 px-3 py-1 text-sm font-bold',
                templateId === t.id ? 'border-kind-live-vivid bg-kind-live-vivid text-white' : 'border-border hover:border-kind-live-vivid',
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {error && <Alert className="mb-4">{error}</Alert>}

      <Card className="overflow-hidden p-5 sm:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={spring.gentle}
          >
            {step === 0 && classes && (
              <WhoStep
                classes={classes}
                groups={groups}
                classId={classId}
                groupId={groupId}
                onClass={(c) => {
                  setClassId(c)
                  setGroupId('')
                }}
                onGroup={setGroupId}
              />
            )}
            {step === 1 && (
              <WhatStep
                settings={settings}
                patch={patch}
                suggest={async () =>
                  (
                    await sessionsApi.breakdown({
                      subject: settings.subject.trim(),
                      topic: settings.topic.trim(),
                      grade_level: settings.grade_level,
                      difficulty: settings.difficulty,
                      session_id: id,
                    })
                  ).parts
                }
              />
            )}
            {step === 2 && <HowStep settings={settings} patch={patch} voices={voices} />}
            {step === 3 && <AfterStep settings={settings} patch={patch} template={saveAs} onTemplate={setSaveAs} />}
          </motion.div>
        </AnimatePresence>
      </Card>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(editing ? 1 : 0, s - 1))} disabled={step === (editing ? 1 : 0)}>
          <ArrowLeft weight="bold" className="size-4" aria-hidden />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!ready[step]}>
            Next
            <ArrowRight weight="bold" className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button onClick={() => void finish()} disabled={busy || !ready.every(Boolean)}>
            <Sparkle weight="fill" className="size-4" aria-hidden />
            {busy ? 'Saving…' : editing ? 'Save the setup' : 'Create the lesson'}
          </Button>
        )}
      </div>
    </Page>
  )
}

function Steps({ index, onPick, skipFirst }: { index: number; onPick: (n: number) => void; skipFirst: boolean }) {
  return (
    <ol aria-label="Setup steps" className="mb-6 grid grid-cols-4 gap-2">
      {STEPS.map((s, n) => {
        const done = n < index
        const here = n === index
        const hidden = skipFirst && n === 0
        return (
          <li key={s.label}>
            <button
              type="button"
              disabled={hidden}
              onClick={() => onPick(n)}
              aria-current={here ? 'step' : undefined}
              className={cn(
                'relative flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-2 text-sm font-bold transition-colors disabled:opacity-40',
                here ? 'text-kind-live' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'grid size-10 place-items-center rounded-full border-2 transition-colors',
                  done ? 'border-kind-live-vivid bg-kind-live-vivid text-white' : here ? 'border-kind-live-vivid bg-kind-live-vivid/10' : 'border-border bg-surface',
                )}
              >
                {done ? <Check weight="bold" className="size-5" aria-hidden /> : <s.Icon weight="bold" className="size-5" aria-hidden />}
              </span>
              {s.label}
              {here && <motion.span layoutId="live-setup-step" className="absolute inset-x-3 -bottom-0.5 h-1 rounded-full bg-kind-live-vivid" transition={spring.snappy} />}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
