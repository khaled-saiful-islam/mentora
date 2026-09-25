import { describe, expect, it } from 'vitest'
import type { User } from '@/lib/user'
import { navFor } from './nav'

function user(role: User['role'], caps: Partial<User['capabilities']>): User {
  return { role, capabilities: caps } as unknown as User
}

describe('navFor', () => {
  it('gives a teacher the studio and classes', () => {
    const keys = navFor(user('teacher', { studio_artifacts: true, manage_classes: true })).map((i) => i.key)
    expect(keys).toEqual(['studio', 'classes', 'settings'])
  })

  it('gives a student their study buddy and classes, never the studio', () => {
    const keys = navFor(user('student', { join_classes: true })).map((i) => i.key)
    expect(keys).toEqual(['chat', 'classes', 'settings'])
  })

  it('adds admin for administrators', () => {
    const keys = navFor(user('admin', { studio_artifacts: true, manage_classes: true, manage_users: true })).map((i) => i.key)
    expect(keys).toContain('admin')
  })

  it('shows nothing to nobody', () => expect(navFor(null)).toEqual([]))
})
