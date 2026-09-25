import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import JoinPage from './JoinPage'

const INVITE = {
  class_id: 'c1',
  class_name: '5 Bestari',
  subject: 'Science',
  grade_label: 'Year 5',
  theme: 'mint',
  teacher_name: 'Cikgu Aisyah',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function serve(me: unknown, joins: string[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/auth/me') return me ? json(me) : json({ error: { message: 'no' } }, 401)
      if (path === '/api/invites/good') return json(INVITE)
      if (path === '/api/invites/good/join' && init?.method === 'POST') {
        joins.push(path)
        return json({ status: 'requested', invite: INVITE })
      }
      return json({ error: { code: 'not_found', message: "This invite isn't working any more — ask your teacher for a new one." } }, 404)
    }),
  )
  return joins
}

function mount(key: string) {
  render(
    <MemoryRouter initialEntries={[`/join/${key}`]}>
      <AuthProvider>
        <PreferencesProvider>
          <Routes>
            <Route path="/join/:key" element={<JoinPage />} />
          </Routes>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

const STUDENT = { id: 's1', role: 'student', capabilities: { join_classes: true }, preferences: { text_scale: 115, font_style: 'playful', motion: 'system', sound: false } }
const TEACHER = { id: 't1', role: 'teacher', capabilities: { manage_classes: true }, preferences: { text_scale: 100, font_style: 'classic', motion: 'system', sound: false } }

afterEach(() => vi.unstubAllGlobals())

describe('JoinPage', () => {
  it('shows a signed-out visitor the class and both ways in', async () => {
    serve(null)
    mount('good')
    expect(await screen.findByText('5 Bestari')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /make my account/i })).toHaveAttribute('href', '/signup/student?invite=good')
    expect(screen.getByRole('link', { name: /already have an account/i })).toHaveAttribute('href', '/signin')
  })

  it('asks to join straight away for a signed-in student', async () => {
    const joins = serve(STUDENT)
    mount('good')
    expect(await screen.findByText('Request sent!')).toBeInTheDocument()
    expect(joins).toHaveLength(1)
  })

  it('never joins a teacher, and says who the link is for', async () => {
    const joins = serve(TEACHER)
    mount('good')
    expect(await screen.findByText(/this invite is for students/i)).toBeInTheDocument()
    expect(joins).toHaveLength(0)
  })

  it('explains a dead link kindly', async () => {
    serve(null)
    mount('stale')
    expect(await screen.findByText(/didn't work/i)).toBeInTheDocument()
    expect(screen.getByText(/ask your teacher/i)).toBeInTheDocument()
  })
})
