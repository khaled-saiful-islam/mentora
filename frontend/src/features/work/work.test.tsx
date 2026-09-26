import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { actionOf, headlineOf, kindOf } from '@/features/notifications/kinds'
import { NotificationsProvider } from '@/features/notifications/NotificationsProvider'
import { AuthProvider } from '@/lib/auth'
import { emit } from '@/lib/bus'
import { PreferencesProvider } from '@/lib/prefs'
import { merge, workOf, type WorkItem } from './api'
import { isShowing, useShowing } from './onScreen'
import { WorkProvider } from './WorkProvider'
import { WorkTray } from './WorkTray'

const TEACHER = { id: 't1', username: 'cikgu', email: 'c@test.com', display_name: 'Cikgu', role: 'teacher', is_admin: false, created_at: '2026-01-01T00:00:00Z' }

const QUIZ: WorkItem = {
  id: 'w1',
  kind: 'quiz',
  title: 'Photosynthesis',
  link: '/library/w1',
  state: 'running',
  progress: 0.5,
  label: 'Mapping the skills',
  message: null,
  started_at: '2026-09-26T08:00:00Z',
  finished_at: null,
}

function note(kind: string, type = 'work_done') {
  return {
    id: 'n1',
    type,
    payload: { work_id: 'w1', kind, title: 'Fractions', link: '/live/1', message: null },
    count: 1,
    read: false,
    created_at: '2026-09-26T08:00:00Z',
    updated_at: '2026-09-26T08:00:00Z',
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('the work list', () => {
  it('replaces a changed item in place, and puts a new one on top', () => {
    const done = { ...QUIZ, state: 'done' as const, progress: 1 }
    expect(merge([QUIZ], done)).toEqual([done])
    expect(merge([QUIZ], { ...QUIZ, id: 'w2' }).map((i) => i.id)).toEqual(['w2', 'w1'])
  })

  it('reads only work pushes', () => {
    expect(workOf({ topic: 'work', work: QUIZ })).toEqual(QUIZ)
    expect(workOf({ topic: 'classes' })).toBeNull()
    expect(workOf({ topic: 'work', work: { nonsense: true } })).toBeNull()
  })
})

describe('what is on screen', () => {
  it('counts while mounted, and forgets on the way out', () => {
    const view = renderHook(({ id }) => useShowing(id), { initialProps: { id: 'w9' } })
    expect(isShowing('w9')).toBe(true)
    view.unmount()
    expect(isShowing('w9')).toBe(false)
  })
})

describe('finished work in the bell', () => {
  it('says what is ready and what to do next, in its own words', () => {
    const lesson = note('live_plan')
    expect(headlineOf(lesson)).toMatch(/Fractions/)
    expect(kindOf(lesson).body?.(lesson)).toMatch(/approve/)
    expect(actionOf(lesson)).toBe('Review it')
    expect(actionOf(note('quiz'))).toBe('Open it')
  })

  it('says plainly when something could not be made', () => {
    const failed = { ...note('flashcard', 'work_failed'), payload: { ...note('flashcard').payload, message: 'No cards passed the checks.' } }
    expect(headlineOf(failed)).toBe("Flashcards on Fractions couldn't be made")
    expect(kindOf(failed).body?.(failed)).toBe('No cards passed the checks.')
  })
})

describe('the tray beside the bell', () => {
  function renderTray(items: WorkItem[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (path: string) => {
        const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
        if (path === '/api/auth/me') return json(TEACHER)
        if (path === '/api/me/work') return json({ items })
        if (path === '/api/notifications') return json({ items: [], next_cursor: null, unread: 0, unseen: 0 })
        return json({})
      }),
    )
    render(
      <MemoryRouter>
        <AuthProvider>
          <PreferencesProvider>
            <NotificationsProvider>
              <WorkProvider>
                <Routes>
                  <Route path="/" element={<WorkTray />} />
                  <Route path="/library/:id" element={<p>The editor</p>} />
                </Routes>
              </WorkProvider>
            </NotificationsProvider>
          </PreferencesProvider>
        </AuthProvider>
      </MemoryRouter>,
    )
  }

  it('stays out of the way when nothing is being made', async () => {
    renderTray([])
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/me/work', expect.anything()))
    expect(screen.queryByRole('button', { name: /background|ready/ })).not.toBeInTheDocument()
  })

  it('shows how far along it is, then offers the way in when it is ready', async () => {
    renderTray([QUIZ])
    await userEvent.click(await screen.findByRole('button', { name: '1 being made in the background' }))
    expect(screen.getByText('Photosynthesis')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Mapping the skills' })).toHaveAttribute('aria-valuenow', '50')

    act(() => emit('live', { topic: 'work', work: { ...QUIZ, state: 'done', progress: 1, label: 'Ready', finished_at: '2026-09-26T08:01:00Z' } }))
    await userEvent.click(await screen.findByRole('button', { name: /Open it/ }))
    expect(await screen.findByText('The editor')).toBeInTheDocument()
  })
})
