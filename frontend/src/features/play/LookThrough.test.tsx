import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SetDetail } from '@/features/learning/api'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { LookThrough } from './LookThrough'

const QUIZ = {
  id: 'set-1',
  kind: 'quiz',
  title: 'Plants',
  skills: [{ slug: 'light', label: 'Light energy' }],
  items: [
    { id: 'q1', prompt: 'What do leaves need?', options: ['Sunlight', 'Sand', 'Snow', 'Smoke'], answer: 0, explanation: 'Leaves use light to make food.', skill: 'light', difficulty: 'easy', source_ids: [] },
    { id: 'q2', prompt: 'Roots take in?', options: ['Air', 'Water', 'Light', 'Heat'], answer: 1, explanation: '', skill: 'light', difficulty: 'medium', source_ids: [] },
  ],
} as unknown as SetDetail

const CARDS = {
  ...QUIZ,
  kind: 'flashcard',
  items: [{ id: 'c1', front: 'Photosynthesis', back: 'How plants make food', hint: 'Think of sunlight', skill: 'light', source_ids: [] }],
} as unknown as SetDetail

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
})

function show(set: SetDetail, onPlay = vi.fn()) {
  render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <LookThrough set={set} onPlay={onPlay} />
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  return onPlay
}

describe('looking through a quiz before sharing it', () => {
  it('shows each question with its answer, one at a time, with nothing to answer', async () => {
    const onPlay = show(QUIZ)
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
    expect(screen.getByText('What do leaves need?')).toBeInTheDocument()
    expect(screen.getByText('Sunlight').closest('li')).toHaveTextContent('Answer')
    expect(screen.getByText('Leaves use light to make food.')).toBeInTheDocument()
    expect(screen.getByText('Light energy')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Next question/ }))
    expect(await screen.findByText('Roots take in?')).toBeInTheDocument()
    expect(screen.getByText('Water').closest('li')).toHaveTextContent('Answer')
    expect(screen.getByRole('button', { name: /Back/ })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: /Finish/ }))
    expect(await screen.findByText("That's all 2 questions")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Play as a student/ }))
    expect(onPlay).toHaveBeenCalled()
  })

  it('jumps with a dot, and walks with the arrow keys', async () => {
    show(QUIZ)
    await userEvent.click(screen.getByRole('button', { name: 'Question 2' }))
    expect(await screen.findByText('Roots take in?')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowLeft}')
    expect(await screen.findByText('What do leaves need?')).toBeInTheDocument()
  })
})

describe('looking through flashcards', () => {
  it('shows both sides of a card and its hint', () => {
    show(CARDS)
    expect(screen.getByText('Card 1 of 1')).toBeInTheDocument()
    expect(screen.getByText('Photosynthesis')).toBeInTheDocument()
    expect(screen.getByText('How plants make food')).toBeInTheDocument()
    expect(screen.getByText('Think of sunlight')).toBeInTheDocument()
  })
})
