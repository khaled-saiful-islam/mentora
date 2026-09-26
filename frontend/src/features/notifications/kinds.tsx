/**
 * How each kind of news looks and sounds: its icon, colour, words, the little
 * show it puts on when it arrives, and where it leads.
 *
 * A new kind is one entry here — the bell, the panel and the pop-up all read
 * from this table. Unknown kinds (a newer server than this page) fall back to
 * a plain bell rather than breaking the list.
 *
 * News is meant to be fun: each kind has a few headlines and one is picked
 * per notification, so the same note always says the same thing but no two
 * days read alike. The safety alert is the exception, and stays plain.
 */
import {
  Bell,
  Broadcast,
  CalendarStar,
  CalendarX,
  Confetti,
  Heartbeat,
  Medal,
  PaperPlaneTilt,
  Trophy,
  UserPlus,
  type Icon,
} from '@phosphor-icons/react'
import type { Mood } from '@/features/buddies'
import { whenLabel } from '@/features/live/sessions/when'
import type { Notification } from './api'

/** The show a pop-up puts on as it lands. */
export type Flourish = 'medal' | 'plane' | 'knock' | 'trophy' | 'confetti' | 'ring' | 'alert'

export interface KindView {
  Icon: Icon
  /** Tile classes for the icon. */
  tile: string
  /** The plain line: for screen readers, and the fallback. */
  title: (n: Notification) => string
  /** A few fun ways to say it. One is picked per notification. */
  headlines?: (n: Notification) => string[]
  body?: (n: Notification) => string | null
  href?: (n: Notification) => string | null
  action?: string
  flourish: Flourish
  /** What a student's buddy does when announcing it. */
  mood: Mood
  /** Stays until dealt with, and never jokes. */
  serious?: boolean
}

const text = (n: Notification, key: string): string => String(n.payload[key] ?? '')

/** When a live lesson is, the way the schedule says it. */
function when(n: Notification): string {
  const at = n.payload.scheduled_at
  return typeof at === 'string' ? whenLabel(at) : 'soon'
}

function others(n: Notification, verb: string): string {
  const actors = (n.payload.actors as string[] | undefined) ?? []
  if (n.count <= 1) return `${actors[0] ?? 'A student'} ${verb}`
  return `${actors[0] ?? 'A student'} and ${n.count - 1} other${n.count > 2 ? 's' : ''} ${verb}`
}

function finished(n: Notification): string[] {
  const actors = (n.payload.actors as string[] | undefined) ?? []
  const who = actors[0] ?? 'A student'
  const title = text(n, 'title')
  const percent = Number(n.payload.percent)
  if (n.count > 1) {
    return [
      others(n, `finished ${title}`),
      `${title} crowd is growing: ${n.count} done!`,
      `${n.count} finished ${title} — latest is ${who}`,
    ]
  }
  if (!Number.isFinite(percent)) return [`${who} finished ${title}`]
  if (percent >= 90) return [`${who} aced ${title} — ${percent}%!`, `Whoa! ${who} scored ${percent}% on ${title}`]
  if (percent >= 70) return [`${who} crushed ${title} — ${percent}%`, `Nice one: ${who} got ${percent}% on ${title}`]
  return [`${who} finished ${title} · ${percent}%`, `${who} gave ${title} a go · ${percent}%`]
}

export const KINDS: Record<string, KindView> = {
  join_request: {
    Icon: UserPlus,
    tile: 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300',
    title: (n) => `${text(n, 'student_name')} wants to join ${text(n, 'class_name')}`,
    headlines: (n) => [
      `Knock knock! ${text(n, 'student_name')} wants into ${text(n, 'class_name')}`,
      `${text(n, 'student_name')} is waiting at the door of ${text(n, 'class_name')}`,
      `New face alert: ${text(n, 'student_name')} wants to join ${text(n, 'class_name')}`,
    ],
    body: (n) => (n.payload.grade_label ? String(n.payload.grade_label) : null),
    href: (n) => `/classes/${text(n, 'class_id')}/requests`,
    action: 'See requests',
    flourish: 'knock',
    mood: 'listen',
  },
  join_approved: {
    Icon: Confetti,
    tile: 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100',
    title: (n) => `You're in ${text(n, 'class_name')}!`,
    headlines: (n) => [
      `You're in! ${text(n, 'class_name')} just got cooler`,
      `Doors open! Welcome to ${text(n, 'class_name')}`,
      `${text(n, 'teacher_name') || 'Your teacher'} said YES! You're in ${text(n, 'class_name')}`,
    ],
    body: (n) => `${text(n, 'teacher_name')} let you in. Say hello!`,
    href: (n) => (n.payload.class_id ? `/classes/${text(n, 'class_id')}` : '/classes'),
    action: 'Open class',
    flourish: 'confetti',
    mood: 'cheer',
  },
  assignment_shared: {
    Icon: PaperPlaneTilt,
    tile: 'bg-grape-100 text-grape-700 dark:bg-grape-800/40 dark:text-grape-100',
    title: (n) => `New ${text(n, 'kind') || 'activity'}: ${text(n, 'title')}`,
    headlines: (n) => [
      `Fresh ${text(n, 'kind') || 'activity'} alert: ${text(n, 'title')}!`,
      `Brain snack incoming: ${text(n, 'title')}`,
      `${text(n, 'teacher_name') || 'Your teacher'} sent you ${text(n, 'title')}. Ready?`,
    ],
    body: (n) => `From ${text(n, 'teacher_name')} · ${text(n, 'class_name')}`,
    href: (n) => (n.payload.assignment_id ? `/play/${text(n, 'assignment_id')}` : null),
    action: "Let's go!",
    flourish: 'plane',
    mood: 'wave',
  },
  live_scheduled: {
    Icon: CalendarStar,
    tile: 'bg-kind-live-vivid/15 text-kind-live',
    title: (n) =>
      n.payload.moved ? `${text(n, 'title')} has moved to ${when(n)}` : `New live lesson: ${text(n, 'title')}, ${when(n)}`,
    headlines: (n) =>
      n.payload.moved
        ? [`${text(n, 'title')} has a new time: ${when(n)}`]
        : [
            `Astra is teaching ${text(n, 'title')} live — ${when(n)}`,
            `A live lesson is on your schedule: ${text(n, 'title')}`,
            `Save the date! ${text(n, 'title')}, ${when(n)}`,
          ],
    body: (n) => `From ${text(n, 'teacher_name')} · ${text(n, 'class_name')}`,
    href: (n) => (n.payload.session_id ? `/room/${text(n, 'session_id')}` : '/schedule'),
    action: 'See it',
    flourish: 'ring',
    mood: 'wave',
  },
  live_reminder: {
    Icon: Broadcast,
    tile: 'bg-kind-live-vivid text-white',
    title: (n) =>
      n.payload.when === 'now'
        ? `${text(n, 'title')} is starting now — join!`
        : n.payload.when === 'soon'
          ? `${text(n, 'title')} starts in 15 minutes`
          : `Tomorrow: ${text(n, 'title')}, ${when(n)}`,
    headlines: (n) =>
      n.payload.when === 'now'
        ? [`Astra is starting ${text(n, 'title')} — come in!`, `It's time! ${text(n, 'title')} is live`]
        : n.payload.when === 'soon'
          ? [`15 minutes to ${text(n, 'title')} — get ready!`]
          : [`Tomorrow: ${text(n, 'title')} with Astra, ${when(n)}`],
    href: (n) => `/room/${text(n, 'session_id')}`,
    action: 'Join',
    flourish: 'ring',
    mood: 'cheer',
  },
  live_cancelled: {
    Icon: CalendarX,
    tile: 'bg-muted text-muted-foreground',
    title: (n) => `${text(n, 'title')} has been cancelled`,
    href: () => '/schedule',
    flourish: 'ring',
    mood: 'oops',
  },
  completion: {
    Icon: Trophy,
    tile: 'bg-kind-quiz-vivid/15 text-kind-quiz',
    title: (n) => others(n, `finished ${text(n, 'title')}`),
    headlines: finished,
    body: (n) => text(n, 'class_name') || null,
    href: (n) => (n.payload.assignment_id ? `/assignments/${text(n, 'assignment_id')}` : null),
    action: 'See results',
    flourish: 'trophy',
    mood: 'happy',
  },
  badge_awarded: {
    Icon: Medal,
    tile: 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300',
    title: (n) => `You earned the ${text(n, 'badge_name')} badge!`,
    headlines: (n) => [
      `Bling! You earned ${text(n, 'badge_name')}`,
      `Shiny new badge: ${text(n, 'badge_name')}!`,
      `Look who just unlocked ${text(n, 'badge_name')}!`,
    ],
    body: (n) => text(n, 'reason') || null,
    href: () => '/badges',
    action: 'See my badge',
    flourish: 'medal',
    mood: 'celebrate',
  },
  safety_alert: {
    Icon: Heartbeat,
    tile: 'bg-coral-100 text-coral-700 dark:bg-coral-700/30 dark:text-coral-100',
    title: (n) => `${text(n, 'student_name') || 'A student'} may need support`,
    body: () => 'Please look at it in the safety queue today.',
    href: () => '/admin/safety',
    action: 'Open the safety queue',
    flourish: 'alert',
    mood: 'listen',
    serious: true,
  },
}

const FALLBACK: KindView = {
  Icon: Bell,
  tile: 'bg-muted text-muted-foreground',
  title: () => 'Something new happened',
  flourish: 'ring',
  mood: 'happy',
}

export function kindOf(n: Notification): KindView {
  return KINDS[n.type] ?? FALLBACK
}

/** The line to show: one of the kind's fun headlines, the same one every
 *  time for this notification, or its plain title. */
export function headlineOf(n: Notification): string {
  const view = kindOf(n)
  const lines = view.serious ? [] : (view.headlines?.(n) ?? []).filter(Boolean)
  if (lines.length === 0) return view.title(n)
  let hash = 0
  for (const char of `${n.id}:${n.count}`) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return lines[Math.abs(hash) % lines.length]
}
