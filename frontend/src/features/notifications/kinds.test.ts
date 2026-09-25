import { describe, expect, it } from 'vitest'
import type { Notification } from './api'
import { headlineOf, kindOf } from './kinds'

function note(type: string, payload: Record<string, unknown>, count = 1): Notification {
  return { id: '1', type, payload, count, read: false, created_at: '', updated_at: '' }
}

describe('notification kinds', () => {
  it('names who wants to join which class, and links to the requests', () => {
    const n = note('join_request', { student_name: 'Adam', class_name: '5 Bestari', class_id: 'c1', grade_label: 'Year 5' })
    const view = kindOf(n)
    expect(view.title(n)).toBe('Adam wants to join 5 Bestari')
    expect(view.body?.(n)).toBe('Year 5')
    expect(view.href?.(n)).toBe('/classes/c1/requests')
  })

  it('celebrates being let in', () => {
    const n = note('join_approved', { class_name: '5 Bestari', teacher_name: 'Cikgu Aisyah' })
    expect(kindOf(n).title(n)).toBe("You're in 5 Bestari!")
  })

  it('collapses many finishers into one line', () => {
    const n = note('completion', { title: 'Photosynthesis', actors: ['Mei', 'Adam'] }, 3)
    expect(kindOf(n).title(n)).toBe('Mei and 2 others finished Photosynthesis')
  })

  it('sends an admin to the safety queue without repeating what was said', () => {
    const n = note('safety_alert', { student_name: 'Adam', category: 'self_harm', event_id: 'e1' })
    const view = kindOf(n)
    expect(view.title(n)).toBe('Adam may need support')
    expect(view.href?.(n)).toBe('/admin/safety')
    expect(`${view.title(n)} ${view.body?.(n)}`).not.toContain('self_harm')
  })

  it('says news in a fun way, the same way every time for the same note', () => {
    const n = note('badge_awarded', { badge_name: 'Hot Streak' })
    const line = headlineOf(n)
    expect(line).toContain('Hot Streak')
    expect(headlineOf(n)).toBe(line)
    expect(line).not.toBe(kindOf(n).title(n))
  })

  it('celebrates a high score in the teacher\'s headline', () => {
    const n = note('completion', { title: 'Plants', actors: ['Mei'], percent: 95 })
    expect(headlineOf(n)).toMatch(/Mei (aced Plants — 95%!|scored 95% on Plants)/)
  })

  it('never jokes about a child who may need support', () => {
    const n = note('safety_alert', { student_name: 'Adam' })
    expect(headlineOf(n)).toBe('Adam may need support')
    expect(kindOf(n).serious).toBe(true)
  })

  it('does not break on a kind this page has never heard of', () => {
    const n = note('from_the_future', {})
    expect(kindOf(n).title(n)).toBe('Something new happened')
  })
})
