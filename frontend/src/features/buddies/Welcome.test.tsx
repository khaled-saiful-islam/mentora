import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { Welcome } from './Welcome'

const STUDENT = {
  id: '7',
  username: 'aina',
  email: null,
  display_name: 'Aina',
  role: 'student',
  is_admin: false,
  grade_level: 'year_4',
  grade_label: 'Year 4',
  buddy: null,
  preferences: { text_scale: 115, font_style: 'playful', motion: 'reduce', sound: false },
  onboarded: false,
  capabilities: {},
  created_at: '2026-09-25T00:00:00Z',
}

function serve() {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method !== 'GET') calls.push(`${method} ${path}`)
      if (path === '/api/auth/me' && method === 'GET') return json(STUDENT)
      if (path === '/api/auth/me' && method === 'PATCH') return json({ ...STUDENT, buddy: 'kiko' })
      if (path === '/api/auth/me/onboarded') return json({ ...STUDENT, buddy: 'kiko', onboarded: true })
      return json({}, 404)
    }),
  )
  return calls
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

afterEach(() => vi.unstubAllGlobals())

describe('Welcome', () => {
  it('saves the buddy and finishes onboarding as soon as one is chosen', async () => {
    const calls = serve()
    render(
      <AuthProvider>
        <PreferencesProvider>
          <ToastProvider>
            <Welcome />
          </ToastProvider>
        </PreferencesProvider>
      </AuthProvider>,
    )

    const user = userEvent.setup()
    const [first] = await screen.findAllByRole('radio')
    await user.click(first)
    await user.click(screen.getByRole('button', { name: /^Choose / }))

    // Saved before "Let's go!" is pressed: a student who leaves on the next
    // screen must not be asked to pick again at the next sign-in.
    await screen.findByRole('button', { name: /Let's go/ })
    await waitFor(() =>
      expect(calls).toEqual(['PATCH /api/auth/me', 'POST /api/auth/me/onboarded']),
    )
  })
})
