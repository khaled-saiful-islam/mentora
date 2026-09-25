/**
 * Where each kind of account can go. One table drives the desktop sidebar,
 * the phone tab bar and the chat sidebar, so a page added for a role is one
 * line here. `show` reads the same capabilities the API enforces.
 */
import { Books, ChatsCircle, ChartLineUp, GearSix, House, Medal, ShieldStar, Smiley, Sparkle, Barbell, UsersThree, type Icon } from '@phosphor-icons/react'
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
const chatPaths = (path: string) => path === '/' || path.startsWith('/c/')
const studentChatPaths = (path: string) => path === '/chat' || path.startsWith('/c/')
const isStudent = (u: User) => u.role === 'student'

/** Where a new chat starts: a student's `/` is their home, so theirs is `/chat`. */
export function chatRoot(user: User | null): string {
  return user && isStudent(user) ? '/chat' : '/'
}

export const NAV: NavItem[] = [
  {
    key: 'studio',
    to: '/',
    label: 'Studio',
    Icon: Sparkle,
    show: (u) => can(u, 'studio_artifacts'),
    matches: chatPaths,
  },
  {
    key: 'home',
    to: '/',
    label: 'Home',
    Icon: House,
    show: isStudent,
    matches: (path) => path === '/' || path.startsWith('/play/') || path.startsWith('/attempts/'),
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
    key: 'library',
    to: '/library',
    label: 'Library',
    Icon: Books,
    show: (u) => can(u, 'share_learning_sets'),
    matches: under('/library'),
  },
  {
    key: 'practice',
    to: '/library',
    label: 'Practice',
    Icon: Barbell,
    show: (u) => can(u, 'make_practice_sets'),
    matches: under('/library'),
  },
  {
    key: 'chat',
    to: '/chat',
    label: 'Chat',
    Icon: ChatsCircle,
    show: isStudent,
    matches: studentChatPaths,
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
