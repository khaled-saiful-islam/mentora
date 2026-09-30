/**
 * What a live lesson's card says about where the lesson is — so a teacher
 * with several can tell at a glance which one Astra is still writing, which
 * is waiting for them, and which class is happening right now. Pure, and
 * tested.
 */
import type { WorkItem } from '@/features/work/api'
import type { SessionSummary } from './api'
import { countdown, joinOpen, sinceLabel, whenLabel } from './when'

/**
 * - `busy`: Astra is writing or recording it; nothing for the teacher to do.
 * - `needs-you`: waiting on the teacher — to check it, or to schedule it.
 * - `live`: the class is happening now.
 * - `open`: the room is open and students are coming in.
 * - `upcoming`: on the schedule.
 * - `problem`: making it went wrong.
 * - `done`: finished or cancelled.
 */
export type CardTone = 'busy' | 'needs-you' | 'live' | 'open' | 'upcoming' | 'problem' | 'done'

export interface CardState {
  tone: CardTone
  badge: string
  /** One line under the badge: how far along, when, or what to do. */
  detail: string | null
  /** 0 to 1 while busy, when the work says how far it is; null otherwise. */
  progress: number | null
  action: string
}

export function cardState(
  session: SessionSummary,
  work: WorkItem | undefined,
  now: Date,
  audience: 'teacher' | 'student',
): CardState {
  if (audience === 'student') return forStudent(session, now)
  const running = work?.state === 'running' ? work : undefined
  const parts = session.parts
  switch (session.status) {
    case 'draft':
      return { tone: 'needs-you', badge: 'Draft', detail: 'Not written yet. Finish setting it up.', progress: null, action: 'Carry on setting up' }
    case 'planning':
      return { tone: 'busy', badge: 'Astra is writing it', detail: running?.label ?? 'Writing the lesson…', progress: running ? running.progress : null, action: 'Watch it being written' }
    case 'recording':
      return { tone: 'busy', badge: 'Recording the voice', detail: running?.label ?? "Recording Astra's voice…", progress: running ? running.progress : null, action: 'See how far it is' }
    case 'planned':
      return {
        tone: 'needs-you',
        badge: 'Ready for you to check',
        detail: parts ? `${parts} part${parts === 1 ? '' : 's'} written. Read them, then approve.` : 'Read it through, then approve.',
        progress: null,
        action: 'Check the lesson',
      }
    case 'approved':
      return { tone: 'needs-you', badge: 'Ready to schedule', detail: 'Recorded. Pick when it happens.', progress: null, action: 'Schedule it' }
    case 'failed':
      return { tone: 'problem', badge: 'Needs another try', detail: session.failure ?? 'Something went wrong while making it.', progress: null, action: 'Try again' }
    case 'scheduled':
      return { tone: 'upcoming', badge: 'On the schedule', detail: startsLine(session, now), progress: null, action: 'Open' }
    case 'lobby':
      return { tone: 'open', badge: 'Room open', detail: 'Students can come in now.', progress: null, action: 'Open the room' }
    case 'live':
      return { tone: 'live', badge: 'Live now', detail: liveLine(session, now), progress: null, action: 'Go to the room' }
    case 'ended':
      return { tone: 'done', badge: 'Finished', detail: session.ended_at ? `Taught ${whenLabel(session.ended_at, now)}` : null, progress: null, action: 'See how it went' }
    case 'cancelled':
      return { tone: 'done', badge: 'Cancelled', detail: null, progress: null, action: 'Open' }
  }
}

function forStudent(session: SessionSummary, now: Date): CardState {
  const open = joinOpen(session.scheduled_at, session.status, now)
  const action = open ? 'Join now' : 'Open'
  if (session.status === 'live') return { tone: 'live', badge: 'Live now', detail: liveLine(session, now), progress: null, action }
  if (session.status === 'lobby') return { tone: 'open', badge: 'Room open', detail: 'You can come in now.', progress: null, action }
  if (session.status === 'ended') return { tone: 'done', badge: 'Finished', detail: null, progress: null, action }
  if (session.status === 'cancelled') return { tone: 'done', badge: 'Cancelled', detail: null, progress: null, action }
  return { tone: open ? 'open' : 'upcoming', badge: 'On the schedule', detail: startsLine(session, now), progress: null, action }
}

function startsLine(session: SessionSummary, now: Date): string | null {
  const soon = session.scheduled_at ? countdown(session.scheduled_at, now) : ''
  return soon ? `Starts ${soon}` : null
}

function liveLine(session: SessionSummary, now: Date): string {
  return session.started_at ? `Astra is teaching · began ${sinceLabel(session.started_at, now)}` : 'Astra is teaching'
}
