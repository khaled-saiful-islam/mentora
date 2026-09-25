/**
 * The voice lab — hear the tutor before a class does.
 *
 * A teacher picks a topic and a voice; Astra writes the opening of a lesson
 * and teaches it here, out loud, with its captions. Part-way, a pretend
 * student raises a hand, is called on, asks, and hears the answer. Nothing
 * of a live session is built until this sounds like a person (PLAN.md §19).
 */
import { ArrowCounterClockwise, HandWaving, Pause, Play, PaperPlaneRight, Sparkle, Waveform } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Field, Input } from '@/components/ui'
import { useGrades } from '@/features/auth/useGrades'
import type { Mood } from '@/features/buddies/types'
import { cn } from '@/lib/utils'
import { Page, rise, spring } from '@/motion'
import { getVoices, type VoiceChoice, type VoiceOffer } from './api'
import { LiveStage } from './LiveStage'
import { TUTOR_NAME } from './TutorAvatar'
import { useVoiceLab, type Phase, type Said } from './useVoiceLab'

const QUESTIONS = [
  "Why don't plants just eat food like us?",
  'Do plants breathe at night?',
  'What happens if a plant gets no sunlight?',
]

// A teacher's pace is about 150 words a minute at 0.85.
const WORDS_PER_MINUTE_AT_ONE = 176

export default function VoiceLabPage() {
  const [offer, setOffer] = useState<VoiceOffer | null>(null)
  const [choice, setChoice] = useState<VoiceChoice | null>(null)
  const [topic, setTopic] = useState('photosynthesis')
  const [grade, setGrade] = useState<string>('year_5')
  const [names, setNames] = useState('Aina, Hafiz, Mei')
  const lab = useVoiceLab(choice ?? { voice: 'fable', model: 'ilmu-tts-v2.1', speed: 0.85 })
  const students = useMemo(() => names.split(',').map((n) => n.trim()).filter(Boolean).slice(0, 8), [names])

  useEffect(() => {
    getVoices()
      .then((o) => {
        setOffer(o)
        setChoice({ voice: o.voice, model: o.model, speed: o.speed })
      })
      .catch(() => undefined)
  }, [])

  const live = ['teaching', 'paused', 'hand', 'called', 'answering'].includes(lab.phase)
  const current = lab.lesson?.beats[lab.beat]

  return (
    <Page className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <motion.header variants={rise} className="mb-6 flex flex-wrap items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-kind-live-vivid text-white shadow-lg">
          <Waveform weight="bold" className="size-6" aria-hidden />
        </span>
        <div className="min-w-[min(100%,16rem)] flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Voice lab</h1>
          <p className="text-muted-foreground">Hear {TUTOR_NAME}, your live tutor, teach before your class does.</p>
        </div>
      </motion.header>

      {lab.error && (
        <Alert tone="warning" className="mb-4">
          {lab.error}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <motion.div variants={rise} className="min-w-0 space-y-4">
          <LiveStage
            beats={lab.lesson ? lab.lesson.beats.length : 0}
            beat={lab.beat}
            show={lab.phase === 'called' || lab.phase === 'answering' ? null : (current?.show ?? null)}
            line={lab.line}
            now={lab.now}
            speaking={lab.speaking}
            level={lab.level}
            mood={moodFor(lab.phase, lab.speaking)}
            hand={lab.asker}
            status={statusFor(lab.phase, topic, lab.asker)}
          >
            <StageControls lab={lab} students={students} />
          </LiveStage>
          <Transcript said={lab.said} />
        </motion.div>

        <motion.aside variants={rise} className="min-w-0 space-y-4">
          <Card className="space-y-4 p-5">
            <h2 className="font-display text-xl font-semibold">The lesson</h2>
            <Field label="Topic" htmlFor="lab-topic">
              <Input id="lab-topic" value={topic} maxLength={160} onChange={(e) => setTopic(e.target.value)} disabled={live} />
            </Field>
            <GradeSelect value={grade} onChange={setGrade} disabled={live} />
            <Field label="Students in the group" htmlFor="lab-names" hint="First names, separated by commas.">
              <Input id="lab-names" value={names} onChange={(e) => setNames(e.target.value)} disabled={live} />
            </Field>
            <Button
              className="w-full"
              onClick={() => void lab.write(topic.trim(), grade || null, students)}
              disabled={live || lab.phase === 'writing' || topic.trim().length < 2}
            >
              <Sparkle weight="fill" className="size-4" aria-hidden />
              {lab.phase === 'writing' ? 'Writing…' : lab.lesson ? 'Write a new lesson' : 'Write the lesson'}
            </Button>
          </Card>

          {offer && choice && <VoiceCard offer={offer} choice={choice} onChange={setChoice} disabled={live} />}

          {lab.lesson && <Script lab={lab} />}
        </motion.aside>
      </div>
    </Page>
  )
}

type Lab = ReturnType<typeof useVoiceLab>

function StageControls({ lab, students }: { lab: Lab; students: string[] }) {
  const [question, setQuestion] = useState('')
  const send = (text: string) => {
    const q = text.trim()
    if (q.length < 2) return
    setQuestion('')
    void lab.ask(q)
  }

  if (lab.phase === 'called') {
    return (
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.gentle}
        onSubmit={(e) => {
          e.preventDefault()
          send(question)
        }}
        className="space-y-3 rounded-3xl bg-white/10 p-4"
      >
        <label htmlFor="lab-question" className="block font-bold">
          {lab.asker}, ask your question
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="lab-question"
            autoFocus
            value={question}
            maxLength={400}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-w-[min(100%,14rem)] flex-1 bg-white text-foreground"
            placeholder="Type the question…"
          />
          <Button type="submit" variant="secondary" disabled={question.trim().length < 2}>
            <PaperPlaneRight weight="fill" className="size-4" aria-hidden />
            Ask
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="rounded-full bg-white/15 px-3 py-1.5 text-left text-sm font-semibold hover:bg-white/25"
            >
              {q}
            </button>
          ))}
        </div>
      </motion.form>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {lab.phase === 'ready' || lab.phase === 'finished' ? (
        <Button variant="sun" onClick={() => void lab.start()}>
          <Play weight="fill" className="size-4" aria-hidden />
          {lab.phase === 'finished' ? 'Play again' : 'Start the lesson'}
        </Button>
      ) : lab.phase === 'paused' ? (
        <Button variant="sun" onClick={() => void lab.resume()}>
          <Play weight="fill" className="size-4" aria-hidden />
          Carry on
        </Button>
      ) : (
        ['teaching', 'hand', 'answering'].includes(lab.phase) && (
          <Button variant="secondary" onClick={() => void lab.pause()}>
            <Pause weight="fill" className="size-4" aria-hidden />
            Pause
          </Button>
        )
      )}
      {['teaching', 'paused', 'hand', 'answering'].includes(lab.phase) && (
        <Button variant="ghost" className="text-white hover:bg-white/10" onClick={lab.reset}>
          <ArrowCounterClockwise weight="bold" className="size-4" aria-hidden />
          Stop
        </Button>
      )}
      {lab.phase === 'teaching' && students.length > 0 && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-white/80">Raise a hand as</span>
          {students.map((name) => (
            <motion.button
              key={name}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => lab.raiseHand(name)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold hover:bg-white/25"
            >
              <HandWaving weight="fill" className="size-4 text-sun-300" aria-hidden />
              {name}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}

function VoiceCard({
  offer,
  choice,
  onChange,
  disabled,
}: {
  offer: VoiceOffer
  choice: VoiceChoice
  onChange: (next: VoiceChoice) => void
  disabled: boolean
}) {
  const wpm = Math.round(WORDS_PER_MINUTE_AT_ONE * choice.speed)
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-display text-xl font-semibold">The voice</h2>
        <p className="text-sm text-muted-foreground">Change it, then play the same lesson again to compare.</p>
      </div>
      <div role="radiogroup" aria-label="Voice" className="flex flex-wrap gap-2">
        {offer.voices.map((voice) => (
          <button
            key={voice}
            type="button"
            role="radio"
            aria-checked={choice.voice === voice}
            disabled={disabled}
            onClick={() => onChange({ ...choice, voice })}
            className={cn(
              'rounded-full border-2 px-3 py-1.5 text-sm font-bold capitalize transition-colors disabled:opacity-50',
              choice.voice === voice
                ? 'border-kind-live-vivid bg-kind-live-vivid text-white'
                : 'border-border bg-surface hover:border-kind-live-vivid',
            )}
          >
            {voice}
          </button>
        ))}
      </div>
      <Field label="Voice model" htmlFor="lab-model">
        <select
          id="lab-model"
          value={choice.model}
          disabled={disabled}
          onChange={(e) => onChange({ ...choice, model: e.target.value })}
          className="w-full rounded-xl border-2 border-border bg-surface px-3 py-2 font-semibold"
        >
          {offer.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`Pace — about ${wpm} words a minute`} htmlFor="lab-speed" hint="A teacher talking to a class is near 150.">
        <input
          id="lab-speed"
          type="range"
          min={offer.min_speed}
          max={offer.max_speed}
          step={0.05}
          value={choice.speed}
          disabled={disabled}
          onChange={(e) => onChange({ ...choice, speed: Number(e.target.value) })}
          className="w-full accent-[hsl(var(--kind-live-vivid))]"
        />
      </Field>
    </Card>
  )
}

function GradeSelect({ value, onChange, disabled }: { value: string; onChange: (code: string) => void; disabled: boolean }) {
  const { groups } = useGrades()
  return (
    <Field label="School level" htmlFor="lab-grade">
      <select
        id="lab-grade"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border-2 border-border bg-surface px-3 py-2 font-semibold"
      >
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
  )
}

function Script({ lab }: { lab: Lab }) {
  const lesson = lab.lesson
  if (!lesson) return null
  return (
    <Card className="space-y-3 p-5">
      <div>
        <h2 className="break-words font-display text-xl font-semibold">{lesson.title}</h2>
        <p className="text-sm text-muted-foreground">
          {lesson.beats.length} parts · about {Math.round(lesson.seconds)} seconds
        </p>
      </div>
      {lesson.problems.length > 0 && (
        <Alert tone="info">
          Still sounds written in places: {lesson.problems.join(' · ')}
        </Alert>
      )}
      <ol className="space-y-2">
        {lesson.beats.map((beat, i) => (
          <li
            key={beat.id}
            className={cn(
              'rounded-2xl border-2 p-3 text-sm transition-colors',
              i === lab.beat ? 'border-kind-live-vivid bg-kind-live-vivid/10' : 'border-transparent bg-muted/60',
            )}
          >
            <p className="break-words leading-relaxed">{beat.say}</p>
            <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              then a {beat.pause === 'think' ? 'moment to think' : beat.pause === 'breath' ? 'breath' : 'short pause'}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function Transcript({ said }: { said: Said[] }) {
  if (said.length === 0) return null
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-display text-xl font-semibold">What was said</h2>
      <ol className="max-h-80 space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {said.map((s) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('break-words rounded-2xl px-3 py-2 text-sm', s.speaker === 'student' ? 'bg-sun-100 text-grape-900' : 'bg-muted')}
            >
              <span className="font-bold">{s.speaker === 'student' ? s.name : TUTOR_NAME}: </span>
              {s.text}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </Card>
  )
}

function moodFor(phase: Phase, speaking: boolean): Mood {
  switch (phase) {
    case 'writing':
      return 'think'
    case 'hand':
      return speaking ? 'wave' : 'listen'
    case 'called':
      return 'listen'
    case 'answering':
      return speaking ? 'happy' : 'think'
    case 'finished':
      return 'celebrate'
    case 'paused':
      return 'sleepy'
    default:
      return 'idle'
  }
}

function statusFor(phase: Phase, topic: string, asker: string | null): React.ReactNode {
  switch (phase) {
    case 'setup':
      return `Pick a topic, and I'll teach you the first part of it.`
    case 'writing':
      return `Writing the opening of a lesson on ${topic}…`
    case 'ready':
      return 'Ready when you are. Turn your sound on and tap Start.'
    case 'hand':
      return `${asker} has a hand up. I'll just finish this thought.`
    case 'called':
      return `${asker} has the floor.`
    case 'answering':
      return `Answering ${asker}…`
    case 'finished':
      return "That's the end of this part. Try another voice, or another topic."
    default:
      return null
  }
}
