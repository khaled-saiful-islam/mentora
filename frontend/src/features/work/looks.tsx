/**
 * How each kind of background work looks and is spoken of, in the tray and
 * in the bell. Learning kinds borrow their look from the learning table.
 */
import { Broadcast, Waveform, type Icon } from '@phosphor-icons/react'
import { lookOfKind } from '@/features/learning/kinds'

export interface WorkLook {
  /** "Quiz", "Live lesson" — what the thing is. */
  label: string
  Icon: Icon
  /** Soft tint for the icon tile. */
  soft: string
  /** Solid accent for the progress bar. */
  bar: string
  /** The line when it is ready: "Your quiz on Fractions is ready". */
  ready: (title: string) => string[]
  /** What to do next, said on the note. */
  next: string
  /** The button that opens it. */
  open: string
}

const LIVE_SOFT = 'bg-kind-live-vivid/15 text-kind-live'

const LOOKS: Record<string, WorkLook> = {
  live_plan: {
    label: 'Live lesson',
    Icon: Broadcast,
    soft: LIVE_SOFT,
    bar: 'bg-kind-live-vivid',
    ready: (t) => [`Astra has written ${t} — have a look`, `Your live lesson on ${t} is written`],
    next: 'Read it through, then approve it so Astra can record her voice.',
    open: 'Review it',
  },
  live_recording: {
    label: "Astra's voice",
    Icon: Waveform,
    soft: LIVE_SOFT,
    bar: 'bg-kind-live-vivid',
    ready: (t) => [`Astra is ready to teach ${t}`, `${t} is recorded and ready to go live`],
    next: 'Her voice is recorded. Schedule it for your group.',
    open: 'Schedule it',
  },
}

const NOUN: Record<string, string> = { quiz: 'quiz', flashcard: 'flashcards', study_guide: 'study guide' }
// Written out whole, so the stylesheet has them.
const BAR: Record<string, string> = {
  quiz: 'bg-kind-quiz-vivid',
  flashcard: 'bg-kind-flashcard-vivid',
  study_guide: 'bg-kind-study-guide-vivid',
}

function learningLook(kind: string): WorkLook {
  const look = lookOfKind(kind)
  const noun = NOUN[kind] ?? look.label.toLowerCase()
  const are = kind === 'flashcard' ? 'are' : 'is'
  return {
    label: look.label,
    Icon: look.Icon,
    soft: look.soft,
    bar: BAR[kind] ?? 'bg-primary',
    ready: (t) => [`Your ${noun} on ${t} ${are} ready`, `Fresh out of the oven: ${t} ${noun}`, `Done! Your ${t} ${noun} ${are} waiting`],
    next: kind === 'study_guide' ? 'Read it through before you share it.' : 'Look it over, then share it with a class.',
    open: 'Open it',
  }
}

export function lookOfWork(kind: string): WorkLook {
  return LOOKS[kind] ?? learningLook(kind)
}
