import { describe, expect, it } from 'vitest'
import type { Capabilities, User } from '@/lib/user'
import { tourFor } from './tours'

function person(role: User['role'], caps: Partial<Capabilities>, extra: Partial<User> = {}): User {
  return {
    id: '1', username: null, email: null, display_name: 'Aina Binti Ali', role, is_admin: false,
    grade_level: null, grade_label: null, buddy: 'rimau',
    preferences: { text_scale: 100, font_style: 'classic', motion: 'system', sound: false },
    onboarded: true, toured: false, capabilities: caps as Capabilities, created_at: '2026-09-27T00:00:00Z', ...extra,
  }
}

const keys = (user: User) => tourFor(user).map((s) => s.key)

describe('the tour for each kind of account', () => {
  it('walks a student through with their own buddy, first and last', () => {
    const steps = tourFor(person('student', { join_live_sessions: true, take_assignments: true }))
    expect(steps.map((s) => s.key)).toEqual(['hello', 'todo', 'practice', 'results', 'live', 'go'])
    expect(steps[0].title).toBe("Hi Aina! I'm Rimau.")
    expect(steps[0].buddy).toBe('wave')
    expect(steps[steps.length - 1].buddy).toBe('celebrate')
  })

  it('shows a teacher classes, making, sharing and live lessons', () => {
    expect(keys(person('teacher', { manage_classes: true, share_learning_sets: true, run_live_sessions: true }))).toEqual(['hello', 'classes', 'make', 'share', 'live'])
  })

  it('shows a parent how to connect, follow, send practice and ask', () => {
    expect(keys(person('parent', { see_children: true, make_family_sets: true, use_chat: true }))).toEqual(['hello', 'link', 'follow', 'send', 'ask'])
  })

  it('leaves out what an account cannot do', () => {
    expect(keys(person('teacher', { manage_classes: true }))).toEqual(['hello', 'classes'])
    expect(keys(person('student', {}))).not.toContain('live')
  })

  it('keeps each tour to a few steps, and has none for an admin or nobody', () => {
    for (const role of ['student', 'teacher', 'parent'] as const) {
      const all = person(role, { join_live_sessions: true, manage_classes: true, share_learning_sets: true, run_live_sessions: true, see_children: true, make_family_sets: true, use_chat: true })
      expect(tourFor(all).length).toBeLessThanOrEqual(6)
    }
    expect(tourFor(person('admin', { manage_users: true }))).toEqual([])
    expect(tourFor(null)).toEqual([])
  })
})
