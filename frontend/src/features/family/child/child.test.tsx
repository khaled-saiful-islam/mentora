import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Todo } from '@/features/play/api'
import type { ChildWork } from '../api'
import { dueFor, isLate } from './bits'
import { WorkTab } from './WorkTab'

afterEach(() => vi.unstubAllGlobals())

const NOW = new Date('2026-09-26T09:00:00Z')

function work(changes: Partial<ChildWork>): ChildWork {
  return {
    assignment_id: 'a1',
    title: 'The Water Cycle',
    kind: 'quiz',
    class_id: 'c1',
    class_name: '5 Bestari',
    class_theme: 'grape',
    item_count: 10,
    status: 'todo',
    best: null,
    attempts: 0,
    due_at: null,
    feedback_mode: 'instant',
    shared_at: '2026-09-20T08:00:00Z',
    review_attempt_id: null,
    ...changes,
  }
}

describe('a child’s work, as a parent sees it', () => {
  it('calls work past due only while it is unfinished', () => {
    const late: Todo = work({ due_at: '2026-09-25T09:00:00Z' })
    expect(dueFor(late, NOW)?.text).toMatch(/^Past due · was due/)
    expect(isLate(late, NOW)).toBe(true)
    expect(dueFor({ ...late, status: 'done' }, NOW)).toBeNull()
    expect(dueFor({ ...late, status: 'closed' }, NOW)).toBeNull()
    expect(dueFor(work({ due_at: '2026-09-27T09:00:00Z' }), NOW)?.late).toBe(false)
  })

  it('groups the work and opens a finished try', async () => {
    const items = [
      work({ assignment_id: 'late', title: 'Late quiz', due_at: '2020-01-01T00:00:00Z' }),
      work({ assignment_id: 'done', title: 'Done deck', kind: 'flashcard', status: 'done', best: 80, attempts: 1, review_attempt_id: 't9' }),
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (path: string) =>
        path === '/api/auth/me' ? new Response('{}', { status: 401 }) : new Response(JSON.stringify({ items, from_home: [] }), { status: 200 }),
      ),
    )
    render(
      <MemoryRouter>
        <AuthProvider>
          <WorkTab childId="k1" first="Aina" />
        </AuthProvider>
      </MemoryRouter>,
    )
    const late = (await screen.findByRole('heading', { name: 'Past due · 1' })).closest('section')!
    expect(within(late).getByText('Late quiz')).toBeInTheDocument()
    const done = screen.getByRole('heading', { name: 'Done · 1' }).closest('section')!
    expect(within(done).getByText(/best 80%/)).toBeInTheDocument()
    expect(within(done).getByRole('link', { name: /See answers/ })).toHaveAttribute('href', '/children/k1/attempts/t9')
    expect(screen.queryByRole('heading', { name: /^To do/ })).toBeNull()
  })
})
