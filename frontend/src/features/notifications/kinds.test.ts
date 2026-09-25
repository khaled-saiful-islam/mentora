import { describe, expect, it } from 'vitest'
import type { Notification } from './api'
import { kindOf } from './kinds'

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

  it('does not break on a kind this page has never heard of', () => {
    const n = note('from_the_future', {})
    expect(kindOf(n).title(n)).toBe('Something new happened')
  })
})
