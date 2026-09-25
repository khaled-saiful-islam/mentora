/**
 * Where each kind of account can go. One table drives the desktop sidebar,
 * the phone tab bar and the chat sidebar, so a page added for a role is one
 * line here. `show` reads the same capabilities the API enforces.
 */
import { Books, ChatsCircle, GearSix, ShieldStar, Sparkle, Barbell, UsersThree, type Icon } from '@phosphor-icons/react'
import { can, type User } from '@/lib/user'

export interface NavItem {
  key: string
  to: string
  label: string
  Icon: Icon
  show: (user: User) => boolean
  /** Which paths light this item up. */
  matches: (path: string) => boolean
}

const under = (prefix: string) => (path: string) => path === prefix || path.startsWith(`${prefix}/`)
const chatPaths = (path: string) => path === '/' || path.startsWith('/c/')

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
    key: 'chat',
    to: '/',
    label: 'Study buddy',
    Icon: ChatsCircle,
    show: (u) => u.role === 'student',
    matches: chatPaths,
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
