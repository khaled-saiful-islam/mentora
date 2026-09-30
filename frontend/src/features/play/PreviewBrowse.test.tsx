import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'
import type { SetDetail } from '@/features/learning/api'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { PlayBackendProvider } from './backend'
import { browseParts, BrowseCards, BrowseQuiz, type BrowseProps } from './PreviewBrowse'
import { previewAttempt, PreviewGrader } from './preview'

const QUIZ = {
  id: 'set-1', kind: 'quiz', title: 'Plants', purpose: 'assign', language: 'en', grade_level: 'year_4',
  skills: [{ slug: 'light', label: 'Light energy' }],
  items: [
    { id: 'q1', prompt: 'What do leaves need?', options: ['Sunlight', 'Sand', 'Snow', 'Smoke'], answer: 0, explanation: 'Leaves use light to make food.', skill: 'light', difficulty: 'easy', source_ids: [] },
    { id: 'q2', prompt: 'Roots take in?', options: ['Air', 'Water', 'Light', 'Heat'], answer: 1, explanation: '', skill: 'light', difficulty: 'medium', source_ids: [] },
  ],
} as unknown as SetDetail

const CARDS = {
  ...QUIZ,
  kind: 'flashcard',
  items: [
    { id: 'c1', front: 'Photosynthesis', back: 'How plants make food', hint: '', skill: 'light', source_ids: [] },
    { id: 'c2', front: 'Root', back: 'Takes in water', hint: '', skill: 'light', source_ids: [] },
  ],
} as unknown as SetDetail

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  vi.stubGlobal('scrollTo', vi.fn())
})

function show(Browse: React.ComponentType<BrowseProps>, set: SetDetail, reveal = false, onPlay = vi.fn()) {
  const grader = new PreviewGrader(set)
  const answer = vi.spyOn(grader, 'answer')
  render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <ToastProvider>
            <PlayBackendProvider value={grader}>
              <Browse attempt={previewAttempt(set)} set={set} reveal={reveal} exitTo="/library/set-1" onPlay={onPlay} />
            </PlayBackendProvider>
          </ToastProvider>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  return { onPlay, answer }
}

describe("previewing a quiz on the student's screen", () => {
  it('walks through every question with Next and Back, answering none', async () => {
    const { onPlay, answer } = show(BrowseQuiz, QUIZ)
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What do leaves need?' })).toBeInTheDocument()
    // The student's tiles are there, but a preview never sends an answer.
    expect(screen.getByRole('button', { name: /Sunlight/ })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /Next question/ }))
    expect(await screen.findByRole('heading', { name: 'Roots take in?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Back/ }))
    expect(await screen.findByRole('heading', { name: 'What do leaves need?' })).toBeInTheDocument()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(await screen.findByText("That's all 2 questions")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Answer it as a student/ }))
    expect(onPlay).toHaveBeenCalled()
    expect(answer).not.toHaveBeenCalled()
  })

  it('marks the right answer and says why, when asked to', () => {
    show(BrowseQuiz, QUIZ, true)
    expect(screen.getByText('Leaves use light to make food.')).toBeInTheDocument()
  })

  it('keeps the answers hidden, as a student sees it, until then', () => {
    show(BrowseQuiz, QUIZ)
    expect(screen.queryByText('Leaves use light to make food.')).not.toBeInTheDocument()
  })
})

describe("previewing flashcards on the student's screen", () => {
  it('turns each card over and moves on, with nothing to mark', async () => {
    show(BrowseCards, CARDS)
    expect(screen.getByText('Card 1 of 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Knew it|Not yet/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Turn it over' }))
    expect(screen.getByRole('button', { name: 'Turn it back' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Next card/ }))
    expect(await screen.findByText('Card 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn it over' })).toBeInTheDocument()
  })
})

describe('the bar along the top', () => {
  it('shows what has been seen, this one, and what is to come', () => {
    expect(browseParts(3, 1)).toEqual(['answered', 'current', 'todo'])
  })
})
