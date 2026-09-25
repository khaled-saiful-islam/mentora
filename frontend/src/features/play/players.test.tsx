import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'
import type { BuddyHandle } from '@/features/buddies'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import type { Attempt } from './api'
import { FlashcardPlayer } from './FlashcardPlayer'
import { QuizPlayer } from './QuizPlayer'

const QUIZ: Attempt = {
  id: 'att-1', status: 'in_progress', number: 1, title: 'Plants', kind: 'quiz', purpose: 'assign',
  feedback_mode: 'instant', assignment_id: 'as-1', set_id: 'set-1',
  items: [
    { id: 'q1', prompt: 'What do leaves need?', options: ['Sunlight', 'Sand', 'Snow', 'Smoke'], skill: 'light', difficulty: 'easy' },
    { id: 'q2', prompt: 'Roots take in?', options: ['Water', 'Air', 'Light', 'Heat'], skill: 'water', difficulty: 'easy' },
  ],
  answered: [], skills: [{ slug: 'light', label: 'Light energy' }], score: 0, max_score: 2, percent: 0,
  best_streak: 0, can_retake: false, attempts_used: 1, leaderboard: false, due_at: null,
  extras: {}, language: 'en',
}

const CARDS: Attempt = {
  ...QUIZ, kind: 'flashcard', title: 'Words',
  items: [
    { id: 'c1', front: 'Photosynthesis', back: 'How plants make food', hint: '', skill: 'light' },
    { id: 'c2', front: 'Root', back: 'Takes in water', hint: '', skill: 'water' },
  ],
}

type Answer = { item_id: string; choice?: number; knew?: boolean }
let answers: Answer[] = []

function api(feedback: 'instant' | 'end') {
  answers = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/answers')) {
        const body = JSON.parse(String(init?.body)) as Answer
        answers.push(body)
        const correct = body.knew ?? body.choice === 0
        const reveal = feedback === 'instant' && body.knew === undefined ? { answer: 0, explanation: 'Leaves catch light.' } : null
        return new Response(JSON.stringify({
          played: { item_id: body.item_id, choice: body.choice ?? null, knew: body.knew ?? null, correct: feedback === 'instant' || body.knew !== undefined ? correct : null, reveal },
          streak: correct ? answers.length : 0, answered: answers.length, total: 2,
        }))
      }
      return new Response('{}', { status: 401 })
    }),
  )
}

function mount(Player: typeof QuizPlayer, attempt: Attempt, onFinished = vi.fn()) {
  render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <ToastProvider>
            <Player attempt={attempt} buddy={createRef<BuddyHandle>()} exitTo="/" onFinished={onFinished} />
          </ToastProvider>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  return onFinished
}

describe('QuizPlayer', () => {
  beforeEach(() => api('instant'))

  it('says right away whether an answer was right, and why', async () => {
    mount(QuizPlayer, QUIZ)
    await userEvent.click(screen.getByRole('button', { name: /Sunlight/ }))
    expect(await screen.findByText('Correct!')).toBeInTheDocument()
    expect(screen.getByText('Leaves catch light.')).toBeInTheDocument()
    expect(answers).toEqual([expect.objectContaining({ item_id: 'q1', choice: 0 })])
  })

  it('shows the right answer after a wrong one', async () => {
    mount(QuizPlayer, QUIZ)
    await userEvent.click(screen.getByRole('button', { name: /Snow/ }))
    expect(await screen.findByText('Not quite')).toBeInTheDocument()
    expect(screen.getByText('Sunlight', { selector: 'span.underline' })).toBeInTheDocument()
  })

  it('answers from the keyboard and finishes after the last question', async () => {
    const onFinished = mount(QuizPlayer, QUIZ)
    await userEvent.keyboard('1')
    await userEvent.click(await screen.findByRole('button', { name: /Next/ }))
    await userEvent.keyboard('2')
    await userEvent.click(await screen.findByRole('button', { name: /See my score/ }))
    expect(onFinished).toHaveBeenCalled()
    expect(answers.map((a) => a.choice)).toEqual([0, 1])
  })

  it('picks up where a student left off', () => {
    mount(QuizPlayer, { ...QUIZ, answered: [{ item_id: 'q1', choice: 0, knew: null, correct: true, reveal: null }] })
    expect(screen.getByText('Roots take in?')).toBeInTheDocument()
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
  })

  it('keeps the verdict secret in end-of-quiz mode', async () => {
    api('end')
    const onFinished = mount(QuizPlayer, { ...QUIZ, feedback_mode: 'end' })
    await userEvent.click(screen.getByRole('button', { name: /Snow/ }))
    await screen.findByText('Roots take in?', {}, { timeout: 2000 })
    expect(screen.queryByText('Not quite')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Water/ }))
    await waitFor(() => expect(onFinished).toHaveBeenCalled(), { timeout: 2000 })
  })
})

describe('FlashcardPlayer', () => {
  beforeEach(() => api('instant'))

  it('flips, takes an honest answer, and brings back the misses for round 2', async () => {
    const onFinished = mount(FlashcardPlayer, CARDS)
    await userEvent.click(screen.getByRole('button', { name: 'Flip it' }))
    await userEvent.click(screen.getByRole('button', { name: /Not yet/ }))
    await screen.findByText('Root', {}, { timeout: 2000 })
    await userEvent.click(screen.getByRole('button', { name: 'Flip it' }))
    await userEvent.click(screen.getByRole('button', { name: /Knew it/ }))
    expect(await screen.findByText('Round 2!', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(answers.map((a) => a.knew)).toEqual([false, true])

    await userEvent.click(screen.getByRole('button', { name: "Let's go!" }))
    await userEvent.click(await screen.findByRole('button', { name: 'Flip it' }))
    await userEvent.click(screen.getByRole('button', { name: /Knew it/ }))
    await waitFor(() => expect(onFinished).toHaveBeenCalled(), { timeout: 2000 })
    // Round 2 is practice: nothing more was sent.
    expect(answers).toHaveLength(2)
  })

  it('will not take an answer before the card is flipped', async () => {
    mount(FlashcardPlayer, CARDS)
    await userEvent.keyboard('{ArrowRight}')
    expect(answers).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Show the front' })).toBeInTheDocument()
  })
})
