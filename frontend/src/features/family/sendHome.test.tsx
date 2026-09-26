import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { actionOf, headlineOf, kindOf } from '@/features/notifications/kinds'
import type { Notification } from '@/features/notifications/api'
import type { HomeWork, Todo } from '@/features/play/api'
import { FromHomeCard } from '@/features/play/TodoCard'
import type { ChildOverview } from './api'
import { waitingOf } from './child/bits'

function note(type: string, payload: Record<string, unknown>): Notification {
  return { id: 'n1', type, payload, count: 1, read: false, created_at: '2026-09-27T08:00:00Z', updated_at: '2026-09-27T08:00:00Z' } as Notification
}

function work(changes: Partial<HomeWork> = {}): HomeWork {
  return {
    share_id: 's1',
    set_id: 'set1',
    title: 'Fractions at the pasar',
    kind: 'quiz',
    item_count: 8,
    parent_id: 'mum',
    label: 'Mum',
    parent_name: 'Siti',
    status: 'todo',
    best: null,
    attempts: 0,
    due_at: null,
    shared_at: '2026-09-27T07:00:00Z',
    review_attempt_id: null,
    ...changes,
  }
}

describe('work sent home', () => {
  it('tells the child who sent it, and takes them straight in', () => {
    const sent = note('family_shared', { share_id: 's1', label: 'Mum', title: 'Fractions', kind: 'flashcard', due_at: null })
    expect(headlineOf(sent)).toMatch(/Mum|Fractions/)
    expect(kindOf(sent).title(sent)).toBe('Mum sent you some flashcards: Fractions')
    expect(kindOf(sent).href?.(sent)).toBe('/from-home/s1')
    expect(actionOf(sent)).toBe('Start')
  })

  it('tells the parent how it went, and opens the answers', () => {
    const done = note('family_done', { student_id: 'k1', student_name: 'Aina', attempt_id: 't1', title: 'Fractions', kind: 'quiz', percent: 80 })
    expect(kindOf(done).title(done)).toBe('Aina finished Fractions — 80%')
    expect(kindOf(done).href?.(done)).toBe('/children/k1/attempts/t1')
    expect(actionOf(done)).toBe('See answers')
  })

  it('shows the child a card saying who it is from', () => {
    render(
      <MemoryRouter>
        <ul>
          <FromHomeCard work={work()} />
        </ul>
      </MemoryRouter>,
    )
    expect(screen.getByText('From Mum')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/from-home/s1')
  })

  it('puts it with school work for the parent, as from them or the other parent', () => {
    const late = work({ share_id: 'late', due_at: '2020-01-01T00:00:00Z' })
    const dads = work({ share_id: 'dad', parent_id: 'dad', label: 'Dad' })
    const done = work({ share_id: 'done', status: 'done', best: 90 })
    const school = { assignment_id: 'a1', title: 'Water', kind: 'quiz', status: 'todo', due_at: null } as Todo
    const overview = { todo: [school], from_home: [dads, done, late] } as unknown as ChildOverview
    const waiting = waitingOf(overview, 'mum')
    expect(waiting.map((w) => w.assignment_id)).toEqual(['late', 'a1', 'dad'])
    expect(waiting.map((w) => w.class_name).slice(0, 1)).toEqual(['From you'])
    expect(waiting[2].class_name).toBe('From Dad')
  })
})
