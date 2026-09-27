/**
 * Where each kind of account can go. One table drives the desktop sidebar,
 * the phone tab bar and the chat sidebar, so a page added for a role is one
 * line here. `show` reads the same capabilities the API enforces.
 */
import { Books, Broadcast, CalendarStar, ChatsCircle, ChartLineUp, GearSix, House, Medal, ShieldStar, Smiley, Sparkle, Barbell, UsersThree, type Icon } from '@phosphor-icons/react'
import { can, type User } from '@/lib/user'

export interface NavItem {
  key: string
  to: string
  label: string
  Icon: Icon
  show: (user: User) => boolean
  /** Which paths light this item up. */
  matches: (path: string) => boolean
  /** Also in the phone's tab bar, which has room for about six. */
  tab?: boolean
}

const under = (prefix: string) => (path: string) => path === prefix || path.startsWith(`${prefix}/`)
const studioPaths = (path: string) => path === '/studio' || path.startsWith('/c/')
const chatPaths = (path: string) => path === '/chat' || path.startsWith('/c/')
const isStudent = (u: User) => u.role === 'student'

/** Where a new chat starts. `/` is everyone's home, so the chat lives in the
 *  studio for those who make things there, and at `/chat` for everyone else
 *  (a parent; a student, once theirs is open). */
export function chatRoot(user: User | null): string {
  return user && !can(user, 'studio_artifacts') ? '/chat' : '/studio'
}

export const NAV: NavItem[] = [
  {
    key: 'home',
    to: '/',
    label: 'Home',
    Icon: House,
    show: () => true,
    matches: (path) => path === '/' || ['/play/', '/attempts/', '/children/'].some((p) => path.startsWith(p)),
  },
  {
    key: 'studio',
    to: '/studio',
    label: 'Studio',
    Icon: Sparkle,
    show: (u) => can(u, 'studio_artifacts'),
    matches: studioPaths,
  },
  {
    key: 'classes',
    to: '/classes',
    label: 'Classes',
    Icon: UsersThree,
    show: (u) => can(u, 'manage_classes') || can(u, 'join_classes'),
    matches: under('/classes'),
  },
  {
    key: 'live',
    to: '/live',
    label: 'Live lessons',
    Icon: Broadcast,
    show: (u) => can(u, 'run_live_sessions'),
    matches: under('/live'),
  },
  {
    key: 'schedule',
    to: '/schedule',
    label: 'Schedule',
    Icon: CalendarStar,
    show: (u) => can(u, 'join_live_sessions'),
    matches: (path) => under('/schedule')(path) || under('/room')(path),
  },
  {
    key: 'library',
    to: '/library',
    label: 'Library',
    Icon: Books,
    // Teachers' sets for their classes; parents' for sending home (§20.4).
    show: (u) => can(u, 'share_learning_sets') || can(u, 'make_family_sets'),
    matches: under('/library'),
  },
  {
    // What a student practises: made for them, and sent from home.
    key: 'practice',
    to: '/practice',
    label: 'Practice',
    Icon: Barbell,
    show: (u) => isStudent(u) && can(u, 'take_assignments'),
    matches: under('/practice'),
  },
  {
    key: 'chat',
    to: '/chat',
    label: 'Chat',
    Icon: ChatsCircle,
    // The chat without the studio: parents now (§20.6), students later.
    show: (u) => can(u, 'use_chat') && !can(u, 'studio_artifacts'),
    matches: chatPaths,
  },
  {
    key: 'results',
    to: '/results',
    label: 'Results',
    Icon: ChartLineUp,
    show: (u) => can(u, 'take_assignments'),
    matches: under('/results'),
    tab: false,
  },
  {
    key: 'badges',
    to: '/badges',
    label: 'Badges',
    Icon: Medal,
    show: (u) => can(u, 'take_assignments'),
    matches: (path) => under('/badges')(path) || under('/leaderboard')(path),
  },
  {
    key: 'buddy',
    to: '/buddy',
    label: 'My buddy',
    Icon: Smiley,
    show: isStudent,
    matches: under('/buddy'),
    tab: false,
  },
  {
    key: 'admin',
    to: '/admin',
    label: 'Admin',
    Icon: ShieldStar,
    show: (u) => can(u, 'manage_users'),
    matches: under('/admin'),
  },
  {
    key: 'settings',
    to: '/settings',
    label: 'Settings',
    Icon: GearSix,
    show: () => true,
    matches: under('/settings'),
  },
]

export function navFor(user: User | null): NavItem[] {
  return user ? NAV.filter((item) => item.show(user)) : []
}
