import { describe, expect, it } from 'vitest'
import type { User } from '@/lib/user'
import { chatRoot, navFor } from './nav'

function user(role: User['role'], caps: Partial<User['capabilities']>): User {
  return { role, capabilities: caps } as unknown as User
}

describe('navFor', () => {
  it('gives a teacher the studio and classes', () => {
    const keys = navFor(user('teacher', { studio_artifacts: true, manage_classes: true, share_learning_sets: true })).map((i) => i.key)
    expect(keys).toEqual(['home', 'studio', 'classes', 'library', 'settings'])
  })

  it('gives a student their home, classes and buddy, never the studio', () => {
    const keys = navFor(user('student', { join_classes: true, make_practice_sets: true, take_assignments: true })).map((i) => i.key)
    expect(keys).toEqual(['home', 'classes', 'practice', 'results', 'badges', 'buddy', 'settings'])
  })

  it('shows a student the chat only once it is open to them', () => {
    const keys = navFor(user('student', { use_chat: true, join_classes: true })).map((i) => i.key)
    expect(keys).toContain('chat')
  })

  it('keeps the phone tab bar to six for a student', () => {
    const items = navFor(user('student', { use_chat: true, join_classes: true, make_practice_sets: true, take_assignments: true }))
    expect(items.filter((i) => i.tab !== false).map((i) => i.key)).toEqual(['home', 'classes', 'practice', 'chat', 'badges', 'settings'])
  })

  it('starts a chat at /chat or in the studio, since / is everyone\'s home', () => {
    expect(chatRoot(user('student', {}))).toBe('/chat')
    expect(chatRoot(user('teacher', {}))).toBe('/studio')
  })

  it('adds admin for administrators', () => {
    const keys = navFor(user('admin', { studio_artifacts: true, manage_classes: true, manage_users: true })).map((i) => i.key)
    expect(keys).toContain('admin')
  })

  it('shows nothing to nobody', () => expect(navFor(null)).toEqual([]))
})
