import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { Bell } from './Bell'
import { NotificationsProvider } from './NotificationsProvider'

const TEACHER = { id: 't1', username: 'cikgu', email: 'c@test.com', display_name: 'Cikgu', role: 'teacher', is_admin: false, created_at: '2026-01-01T00:00:00Z' }

const REMINDER = {
  id: 'n1',
  type: 'live_reminder',
  payload: { session_id: 's1', title: 'Photosynthesis', stage: 'now' },
  count: 1,
  read: false,
  created_at: '2026-09-26T08:00:00Z',
  updated_at: '2026-09-26T08:00:00Z',
}

/** A server with one unread reminder, that remembers seen and read. */
function server() {
  const state = { unseen: 1, read: false }
  const calls: string[] = []
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push(`${method} ${path}`)
      if (path === '/api/auth/me') return json(TEACHER)
      if (path === '/api/notifications/seen') {
        state.unseen = 0
        return json({ unread: state.read ? 0 : 1, unseen: 0 })
      }
      if (path === '/api/notifications/n1/read') {
        state.read = true
        state.unseen = 0
        return json({ ...REMINDER, read: true })
      }
      if (path === '/api/notifications') {
        return json({ items: [{ ...REMINDER, read: state.read }], next_cursor: null, unread: state.read ? 0 : 1, unseen: state.unseen })
      }
      return json({})
    }),
  )
  return calls
}

function renderBell() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <PreferencesProvider>
          <NotificationsProvider>
            <Routes>
              <Route path="/" element={<Bell />} />
              <Route path="/room/:id" element={<p>In the room</p>} />
            </Routes>
          </NotificationsProvider>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('the bell', () => {
  it('clears its red badge when opened, and keeps the note new until it is read', async () => {
    const calls = server()
    renderBell()
    const bell = await screen.findByRole('button', { name: 'Notifications, 1 new' })
    await userEvent.click(bell)

    await waitFor(() => expect(calls).toContain('POST /api/notifications/seen'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument())
    expect(screen.getByText('New')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Mark as read/ }))
    await waitFor(() => expect(calls).toContain('POST /api/notifications/n1/read'))
    await waitFor(() => expect(screen.getByText('Earlier')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Mark as read/ })).not.toBeInTheDocument()
  })

  it('offers the way in when the note leads somewhere', async () => {
    const calls = server()
    renderBell()
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 new' }))
    await userEvent.click(await screen.findByRole('button', { name: /^Join/ }))

    expect(await screen.findByText('In the room')).toBeInTheDocument()
    expect(calls).toContain('POST /api/notifications/n1/read')
  })
})
