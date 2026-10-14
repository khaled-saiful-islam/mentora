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
  id: 'att-1', status: 'in_progress', number: 1, title: 'Plants', kind: 'quiz', purpose: 'assign',
  feedback_mode: 'instant', assignment_id: 'as-1', set_id: 'set-1',
  items: [
    { id: 'q1', prompt: 'What do leaves need?', options: ['Sunlight', 'Sand', 'Snow', 'Smoke'], skill: 'light', difficulty: 'easy' },
    { id: 'q2', prompt: 'Roots take in?', options: ['Water', 'Air', 'Light', 'Heat'], skill: 'water', difficulty: 'easy' },
  ],
  answered: [], skills: [{ slug: 'light', label: 'Light energy' }], score: 0, max_score: 2, percent: 0,
  best_streak: 0, can_retake: false, attempts_used: 1, leaderboard: false, due_at: null,
  extras: {}, language: 'en', second_chance: true,
}

const EXPLAINED = {
  why: 'Leaves use sunlight to make food.',
  example: { problem: 'What does a plant in a dark cupboard lack?', steps: ['Plants need light.', 'A cupboard is dark.'], answer: 'Light' },
  remember: 'No light, no food.',
  written: true,
}
const TWIN = { prompt: 'What gives a plant energy?', options: ['Rocks', 'The sun', 'Wind', 'Ice'], choice: null, correct: null, answer: null, explanation: null, grew: false }

const asked: string[] = []

function api({ twin = TWIN as typeof TWIN | null } = {}) {
  asked.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      asked.push(url)
      const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
      if (url.endsWith('/answers')) {
        const body = JSON.parse(String(init?.body)) as { item_id: string; choice: number }
        const correct = body.choice === 0
        return json({ played: { item_id: body.item_id, choice: body.choice, knew: null, correct, reveal: { answer: 0, explanation: '' } }, streak: 0, answered: 1, total: 2 })
      }
      if (url.includes('/explain')) return json({ ...EXPLAINED, level: new URL(url, 'http://x').searchParams.get('level') })
      if (url.endsWith('/twin/answer')) {
        const { choice } = JSON.parse(String(init?.body)) as { choice: number }
        return json({ twin: { ...TWIN, choice, correct: choice === 1, answer: 1, explanation: 'The sun gives energy.', grew: choice === 1 } })
      }
      if (url.endsWith('/twin')) return json({ twin })
      return new Response('{}', { status: 401 })
    }),
  )
}

function mount(attempt: Attempt = QUIZ) {
  render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <ToastProvider>
            <QuizPlayer attempt={attempt} buddy={createRef<BuddyHandle>()} exitTo="/" onFinished={vi.fn()} />
          </ToastProvider>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

async function missAndOpen() {
  await userEvent.click(screen.getByRole('button', { name: /Snow/ }))
  await userEvent.click(await screen.findByRole('button', { name: /Let's look at it together/ }))
  return screen.findByRole('dialog', { name: "Let's look at it together" })
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('second chance (§28.3.7)', () => {
  it('explains a wrong answer at the chosen level, with a worked example', async () => {
    api()
    mount()
    const sheet = await missAndOpen()
    expect(await within(sheet).findByText('Leaves use sunlight to make food.')).toBeInTheDocument()
    expect(within(sheet).getByText('A cupboard is dark.')).toBeInTheDocument()
    expect(within(sheet).getByText('No light, no food.')).toBeInTheDocument()
    expect(within(sheet).getByText('The answer: Sunlight')).toBeInTheDocument()
    expect(asked.some((u) => u.endsWith('/items/q1/explain?level=core'))).toBe(true)
    await userEvent.click(within(sheet).getByRole('radio', { name: /Simpler/ }))
    expect(asked.some((u) => u.endsWith('/explain?level=simple'))).toBe(true)
  })

  it('cheers a comeback when the one like it is right', async () => {
    api()
    mount()
    const sheet = await missAndOpen()
    await userEvent.click(within(sheet).getByRole('button', { name: /Try one like it/ }))
    expect(await within(sheet).findByText('What gives a plant energy?')).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: /The sun/ }))
    expect(await within(sheet).findByText('You got it! What a comeback.')).toBeInTheDocument()
    expect(within(sheet).getByText(/grew a little!/)).toBeInTheDocument()
  })

  it('shows the answer kindly when the second try is wrong too', async () => {
    api()
    mount()
    const sheet = await missAndOpen()
    await userEvent.click(within(sheet).getByRole('button', { name: /Try one like it/ }))
    await userEvent.click(await within(sheet).findByRole('button', { name: /Rocks/ }))
    expect(await within(sheet).findByText('Nearly there.')).toBeInTheDocument()
    expect(within(sheet).getByText('The sun', { selector: 'span.underline' })).toBeInTheDocument()
    expect(within(sheet).queryByText(/grew a little/)).toBeNull()
  })

  it('says so when there is no question like it, and goes on to the next question', async () => {
    api({ twin: null })
    mount()
    const sheet = await missAndOpen()
    await userEvent.click(within(sheet).getByRole('button', { name: /Try one like it/ }))
    expect(await within(sheet).findByText(/No question like it just now/)).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: /Next question/ }))
    expect(await screen.findByText('Roots take in?')).toBeInTheDocument()
  })

  it('is not offered after a right answer, or in a test', async () => {
    api()
    mount()
    await userEvent.click(screen.getByRole('button', { name: /Sunlight/ }))
    expect(await screen.findByText('Correct!')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Let's look at it together/ })).toBeNull()
  })

  it('is not offered when the teacher set a test', async () => {
    api()
    mount({ ...QUIZ, second_chance: false })
    await userEvent.click(screen.getByRole('button', { name: /Snow/ }))
    expect(await screen.findByText('Not quite')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Let's look at it together/ })).toBeNull()
  })
})
