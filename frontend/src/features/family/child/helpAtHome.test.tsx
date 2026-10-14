import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import type { SkillInsight } from '@/features/play/api'
import { KINDS } from '@/features/notifications/kinds'
import type { Notification } from '@/features/notifications/api'
import { inTheRed } from '@/features/results/api'
import { CheerButton } from './Cheers'
import { HelpAtHome } from './HelpAtHome'

const SKILL: SkillInsight = { subject: 'Science', slug: 'light', label: 'Light energy', correct: 1, total: 4, mastery: 0.25, level: 'practise' }

const HELP = {
  meaning: 'Light energy is energy we can see.',
  example: 'The sun gives us light.',
  activity: { title: 'Shadow hunt', minutes: 5, needs: ['a torch'], steps: ['Switch off the lights.', 'Find a shadow.'] },
}

function serve(routes: Record<string, (init?: RequestInit) => unknown>) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      const route = Object.keys(routes).find((path) => url.includes(path))
      if (!route) return new Response('{}', { status: 401 })
      return new Response(JSON.stringify(routes[route](init)), { status: 200, headers: { 'content-type': 'application/json' } })
    }),
  )
  return calls
}

function wrap(children: React.ReactNode) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <ToastProvider>{children}</ToastProvider>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('help at home (§28.3.3)', () => {
  it('says what the skill means and what to do at home, in either language', async () => {
    const calls = serve({ '/skills/light/help': () => HELP })
    wrap(<HelpAtHome childId="c1" first="Aina" buddy="momo" skill={SKILL} onClose={() => undefined} />)
    expect(screen.getByRole('dialog', { name: 'Help at home: Light energy' })).toHaveTextContent('Aina is getting 25% on this right now.')
    expect(await screen.findByText('Light energy is energy we can see.')).toBeInTheDocument()
    expect(screen.getByText('Shadow hunt')).toBeInTheDocument()
    expect(screen.getByText('5 min, no screen')).toBeInTheDocument()
    expect(screen.getByText('Switch off the lights.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Bahasa Melayu' }))
    await waitFor(() => expect(calls.some((c) => c.url.includes('language=ms'))).toBe(true))
  })

  it('sends a challenge the buddy brings, once', async () => {
    const calls = serve({ '/skills/light/help': () => HELP, '/challenges': () => ({ set_id: 's1', skill: 'Light energy', status: 'making' }) })
    wrap(<HelpAtHome childId="c1" first="Aina" buddy="momo" skill={SKILL} onClose={() => undefined} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Send a challenge' }))
    expect(await screen.findByText(/On its way! Momo will bring it to Aina/)).toBeInTheDocument()
    const posted = calls.find((c) => c.url.includes('/challenges'))
    expect(posted?.init?.body).toBe(JSON.stringify({ skill: 'light' }))
    expect(screen.queryByRole('button', { name: 'Send a challenge' })).not.toBeInTheDocument()
  })

  it('cheers the child on with a preset sticker', async () => {
    const calls = serve({
      '/cheers': (init) => (init?.method === 'POST' ? { sticker: '🌟', line: 'So proud of you!' } : { items: [{ key: 'proud', sticker: '🌟', line: 'So proud of you!' }] }),
    })
    wrap(<CheerButton childId="c1" first="Aina" buddy="momo" />)
    await userEvent.click(screen.getByRole('button', { name: 'Cheer Aina on' }))
    await userEvent.click(await screen.findByRole('button', { name: /So proud of you!/ }))
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'POST' && c.init.body === JSON.stringify({ cheer: 'proud' }))).toBe(true))
  })
})

describe('a cheer arriving', () => {
  it('is said as the parent says it, with the sticker', () => {
    const note = { type: 'cheer', payload: { label: 'Mum', line: 'So proud of you!', sticker: '🌟' } } as unknown as Notification
    expect(KINDS.cheer.title(note)).toBe('Mum says: So proud of you! 🌟')
    expect(KINDS.cheer.mood).toBe('celebrate')
  })
})

describe('practice for these students', () => {
  it('is made for just the students in the red on that skill', () => {
    const heat = { a: { light: 0.2, water: 0.9 }, b: { light: 0.6 }, c: { water: 0.1 } }
    expect(inTheRed({ heat }, 'light')).toEqual(['a'])
    expect(inTheRed({ heat }, 'water')).toEqual(['c'])
  })
})
