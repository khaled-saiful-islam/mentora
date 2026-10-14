import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'
import type { BuddyHandle } from '@/features/buddies'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import type { Attempt } from './api'
import { QuizPlayer } from './QuizPlayer'

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

const QUIZ: Attempt = {
  id: 'att-1', status: 'in_progress', number: 1, title: 'Cells', kind: 'quiz', purpose: 'assign',
  feedback_mode: 'instant', assignment_id: 'as-1', set_id: 'set-1',
  items: [
    { id: 'q1', prompt: 'Where is DNA kept?', options: ['Nucleus', 'Wall', 'Vacuole', 'Membrane'], skill: 'cells', difficulty: 'easy' },
    { id: 'q2', prompt: 'What makes food in a leaf cell?', options: ['Chloroplast', 'Nucleus', 'Wall', 'Vacuole'], skill: 'cells', difficulty: 'easy' },
  ],
  answered: [], skills: [], score: 0, max_score: 2, percent: 0, best_streak: 0, can_retake: false,
  attempts_used: 1, leaderboard: false, due_at: null, extras: {}, language: 'en', second_chance: true,
}

const asked: { url: string; body?: string }[] = []

function api(grade: string) {
  asked.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      asked.push({ url, body: init?.body ? String(init.body) : undefined })
      const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
      if (url.endsWith('/auth/me')) return json({ id: 'u1', role: 'student', display_name: 'Adam', grade_level: grade, buddy: 'momo', capabilities: {}, preferences: {} })
      if (url.endsWith('/me/why')) return json({ left: 5 })
      if (url.endsWith('/why')) return json({ verdict: 'spot_on', feedback: 'Yes: chloroplasts use light to make food.' })
      if (url.endsWith('/answers')) {
        const body = JSON.parse(String(init?.body)) as { item_id: string; choice: number }
        return json({ played: { item_id: body.item_id, choice: body.choice, knew: null, correct: body.choice === 0, reveal: { answer: 0, explanation: '' } }, streak: 1, answered: 1, total: 2 })
      }
      return new Response('{}', { status: 404 })
    }),
  )
}

function mount() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <ToastProvider>
            <QuizPlayer attempt={QUIZ} buddy={createRef<BuddyHandle>()} exitTo="/" onFinished={vi.fn()} />
          </ToastProvider>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('explain why (§28.3.5)', () => {
  it('asks a Form student why, on the second right answer, and says what it made of it', async () => {
    api('form_2')
    mount()
    await screen.findByText('Where is DNA kept?')
    await userEvent.click(screen.getByRole('button', { name: /Nucleus/ }))
    const first = await screen.findByRole('button', { name: /^Next/ })
    // Not on the first right answer: every third, from the second.
    expect(screen.queryByRole('button', { name: /Tell me why/ })).toBeNull()
    await userEvent.click(first)
    await userEvent.click(await screen.findByRole('button', { name: /Chloroplast/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Tell me why/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Tell me why' })
    await userEvent.type(within(sheet).getByRole('textbox', { name: 'Why it is right' }), 'Chloroplasts use light')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Check my thinking' }))
    expect(await within(sheet).findByText('Spot on!')).toBeInTheDocument()
    expect(asked.some((a) => a.url.endsWith('/items/q2/why') && a.body?.includes('Chloroplasts use light'))).toBe(true)
  })

  it('never asks a primary student', async () => {
    api('year_5')
    mount()
    await screen.findByText('Where is DNA kept?')
    await userEvent.click(screen.getByRole('button', { name: /Nucleus/ }))
    await userEvent.click(await screen.findByRole('button', { name: /^Next/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Chloroplast/ }))
    await screen.findByRole('button', { name: /See my score/ })
    expect(screen.queryByRole('button', { name: /Tell me why/ })).toBeNull()
    expect(asked.some((a) => a.url.endsWith('/me/why'))).toBe(false)
  })
})
