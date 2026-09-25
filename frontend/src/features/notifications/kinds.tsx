/**
 * How each kind of news looks: its icon, colour, words and where it leads.
 *
 * A new kind is one entry here — the bell, the panel and the toasts all read
 * from this table. Unknown kinds (a newer server than this page) fall back to
 * a plain bell rather than breaking the list.
 */
import { Bell, Confetti, Heartbeat, Medal, Sparkle, Trophy, UserPlus, type Icon } from '@phosphor-icons/react'
import type { Notification } from './api'

export interface KindView {
  Icon: Icon
  /** Tile classes for the icon. */
  tile: string
  title: (n: Notification) => string
  body?: (n: Notification) => string | null
  href?: (n: Notification) => string | null
}

const text = (n: Notification, key: string): string => String(n.payload[key] ?? '')

function others(n: Notification, verb: string): string {
  const actors = (n.payload.actors as string[] | undefined) ?? []
  if (n.count <= 1) return `${actors[0] ?? 'A student'} ${verb}`
  return `${actors[0] ?? 'A student'} and ${n.count - 1} other${n.count > 2 ? 's' : ''} ${verb}`
}

export const KINDS: Record<string, KindView> = {
  join_request: {
    Icon: UserPlus,
    tile: 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300',
    title: (n) => `${text(n, 'student_name')} wants to join ${text(n, 'class_name')}`,
    body: (n) => (n.payload.grade_label ? String(n.payload.grade_label) : null),
    href: (n) => `/classes/${text(n, 'class_id')}/requests`,
  },
  join_approved: {
    Icon: Confetti,
    tile: 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100',
    title: (n) => `You're in ${text(n, 'class_name')}!`,
    body: (n) => `${text(n, 'teacher_name')} let you in. Say hello!`,
    href: () => '/classes',
  },
  assignment_shared: {
    Icon: Sparkle,
    tile: 'bg-grape-100 text-grape-700 dark:bg-grape-800/40 dark:text-grape-100',
    title: (n) => `New ${text(n, 'kind') || 'activity'}: ${text(n, 'title')}`,
    body: (n) => `From ${text(n, 'teacher_name')} · ${text(n, 'class_name')}`,
    href: (n) => (n.payload.assignment_id ? `/play/${text(n, 'assignment_id')}` : null),
  },
  completion: {
    Icon: Trophy,
    tile: 'bg-kind-quiz-vivid/15 text-kind-quiz',
    title: (n) => others(n, `finished ${text(n, 'title')}`),
    body: (n) => text(n, 'class_name') || null,
    href: (n) => (n.payload.assignment_id ? `/assignments/${text(n, 'assignment_id')}` : null),
  },
  safety_alert: {
    Icon: Heartbeat,
    tile: 'bg-coral-100 text-coral-700 dark:bg-coral-700/30 dark:text-coral-100',
    title: (n) => `${text(n, 'student_name') || 'A student'} may need support`,
    body: () => 'Please look at it in the safety queue today.',
    href: () => '/admin/safety',
  },
  badge_awarded: {
    Icon: Medal,
    tile: 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300',
    title: (n) => `You earned the ${text(n, 'badge_name')} badge!`,
    body: (n) => text(n, 'reason') || null,
    href: () => '/badges',
  },
}

const FALLBACK: KindView = {
  Icon: Bell,
  tile: 'bg-muted text-muted-foreground',
  title: () => 'Something new happened',
}

export function kindOf(n: Notification): KindView {
  return KINDS[n.type] ?? FALLBACK
}
