import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { TextSizeControl } from './TextSizeControl'

function user(text_scale: number) {
  return {
    id: '1',
    username: 'adam',
    email: null,
    display_name: 'Adam',
    role: 'student',
    is_admin: false,
    grade_level: 'year_4',
    grade_label: 'Year 4',
    buddy: null,
    preferences: { text_scale, font_style: 'playful', motion: 'system', sound: false },
    onboarded: true,
    capabilities: {},
    created_at: '2026-01-01T00:00:00Z',
  }
}

function serve(initial: number) {
  const calls: { path: string; body: unknown }[] = []
  let current = initial
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/auth/me/preferences') {
        const body = JSON.parse(String(init?.body)) as { text_scale: number }
        calls.push({ path, body })
        current = body.text_scale
      }
      return new Response(JSON.stringify(user(current)), { status: 200 })
    }),
  )
  return calls
}

function mount() {
  render(
    <AuthProvider>
      <PreferencesProvider>
        <TextSizeControl />
      </PreferencesProvider>
    </AuthProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('TextSizeControl', () => {
  it('steps up one size and saves it to the account', async () => {
    const calls = serve(115)
    mount()
    const bigger = await screen.findByRole('button', { name: 'Bigger text' })
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1.15'))

    await userEvent.click(bigger)

    await waitFor(() => expect(calls).toEqual([{ path: '/api/auth/me/preferences', body: { text_scale: 130 } }]))
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1.3')
  })

  it('cannot go past the biggest size', async () => {
    serve(150)
    mount()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bigger text' })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Smaller text' })).toBeEnabled()
  })
})
