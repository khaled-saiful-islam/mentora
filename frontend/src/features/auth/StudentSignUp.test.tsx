import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import StudentSignUp from './StudentSignUp'

const GRADES = [
  { code: 'year_3', label: 'Year 3', stage: 'Primary' },
  { code: 'year_4', label: 'Year 4', stage: 'Primary' },
  { code: 'form_1', label: 'Form 1', stage: 'Secondary' },
]

function serve() {
  const signups: unknown[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/auth/me') return json({ error: { code: 'unauthorized', message: 'no' } }, 401)
      if (path === '/api/config') return json({ grades: GRADES })
      if (path.startsWith('/api/auth/username-available')) {
        const taken = path.endsWith('=adam')
        return json({
          available: !taken,
          reason: taken ? 'That username is taken.' : null,
          suggestions: taken ? ['adam2', 'adam3'] : [],
        })
      }
      if (path === '/api/auth/signup/student') {
        signups.push(JSON.parse(String(init?.body)))
        return json({ id: '9', role: 'student', preferences: { text_scale: 115, font_style: 'playful', motion: 'system', sound: false }, capabilities: {} }, 201)
      }
      return json({}, 404)
    }),
  )
  return signups
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function mount(path = '/signup/student') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <PreferencesProvider>
          <Routes>
            <Route path="/signup/student" element={<StudentSignUp />} />
            <Route path="/" element={<p>home</p>} />
          </Routes>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('StudentSignUp', () => {
  it('walks four small steps and creates the account', async () => {
    const signups = serve()
    const user = userEvent.setup()
    mount()

    const next = () => screen.getByRole('button', { name: /next/i })
    expect(next()).toBeDisabled()
    await user.type(screen.getByPlaceholderText('Type your name'), 'Adam Tan')
    await user.click(next())

    expect(await screen.findByText(/nice to meet you, adam!/i)).toBeInTheDocument()
    await user.click(await screen.findByRole('radio', { name: 'Year 4' }))
    await user.click(next())

    await user.type(await screen.findByPlaceholderText('e.g. adam_5b'), 'adam')
    expect(await screen.findByText('That username is taken.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'adam2' }))
    expect(await screen.findByText(/that one's yours/i)).toBeInTheDocument()
    await user.click(next())

    await user.type(await screen.findByLabelText(/show password/i).then(() => document.getElementById('password')!), 'secret123')
    await user.click(screen.getByRole('button', { name: /let's go/i }))

    await waitFor(() => expect(screen.getByText('home')).toBeInTheDocument())
    expect(signups).toEqual([
      { name: 'Adam Tan', grade_level: 'year_4', username: 'adam2', password: 'secret123' },
    ])
  })

  it('carries an invite token from the link into the signup', async () => {
    const signups = serve()
    const user = userEvent.setup()
    mount('/signup/student?invite=abc123')

    await user.type(screen.getByPlaceholderText('Type your name'), 'Mei')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(await screen.findByRole('radio', { name: 'Form 1' }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(await screen.findByPlaceholderText('e.g. adam_5b'), 'mei_f1')
    await screen.findByText(/that one's yours/i)
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(document.getElementById('password')!, 'secret123')
    await user.click(screen.getByRole('button', { name: /let's go/i }))

    await waitFor(() => expect(signups).toHaveLength(1))
    expect(signups[0]).toMatchObject({ invite_token: 'abc123' })
  })
})
