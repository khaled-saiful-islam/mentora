import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'
import type { BuddyHandle } from '@/features/buddies'
import type { SetDetail } from '@/features/learning/api'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { PlayBackendProvider } from './backend'
import { levelFor, levelForGrade, lookFor, PlayLevelProvider, type PlayLevel } from './level'
import { previewAttempt, PreviewGrader } from './preview'
import { QuizPlayer } from './QuizPlayer'

// jsdom has no canvas to throw confetti on.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

afterEach(() => vi.unstubAllGlobals())

const SET = {
  id: 's1', kind: 'quiz', purpose: 'assign', title: 'Plants', subject: 'Science', topic: 'plants',
  grade_level: 'year_2', grade_label: 'Year 2', language: 'en', status: 'ready', failure: null,
  item_count: 2, requested_count: 2, version: 1, grounded: true, shares: 0, archived: false,
  updated_at: '2026-09-27T00:00:00Z', sources: [], extras: {},
  skills: [{ slug: 'light', label: 'Light energy' }, { slug: 'water', label: 'Water' }],
  items: [
    { id: 'q1', prompt: 'What do leaves need?', options: ['Sunlight', 'Sand', 'Snow', 'Smoke'], answer: 0, explanation: 'Leaves catch light.', skill: 'light', difficulty: 'easy', source_ids: [] },
    { id: 'q2', prompt: 'Roots take in?', options: ['Air', 'Water', 'Light', 'Heat'], answer: 1, explanation: 'Roots drink.', skill: 'water', difficulty: 'easy', source_ids: [] },
  ],
} as unknown as SetDetail

describe('the look for a year', () => {
  it('is picked from the school year', () => {
    expect(['year_1', 'year_2', 'year_3'].map(levelForGrade)).toEqual(['little', 'little', 'little'])
    expect(['year_4', 'year_5', 'year_6'].map(levelForGrade)).toEqual(['middle', 'middle', 'middle'])
    expect(['form_1', 'form_5', 'lower_6', null, undefined, ''].map(levelForGrade)).toEqual(['senior', 'senior', 'senior', 'senior', 'senior', 'senior'])
  })

  it("follows the student's own year, and the set's when theirs is unknown", () => {
    expect(levelFor('form_2', 'year_1')).toBe('senior')
    expect(levelFor(null, 'year_1')).toBe('little')
    expect(levelFor(undefined, null)).toBe('senior')
  })

  it('keeps still for a child who asked for calm, but keeps the colour and words', () => {
    const calm = lookFor('little', true)
    expect([calm.bob, calm.backdrop, calm.cheerEveryRight]).toEqual([false, false, false])
    expect([calm.tiles, calm.starPath, calm.readAloud]).toEqual(['bright', true, true])
    expect(lookFor('senior').rightWords).toEqual(['Correct!'])
  })
})

describe('a preview', () => {
  it('shows a student the questions and never the answer key', () => {
    const attempt = previewAttempt(SET)
    expect(attempt.items.every((i) => !('answer' in i) && !('explanation' in i))).toBe(true)
    expect([attempt.feedback_mode, attempt.grade_level, attempt.max_score]).toEqual(['instant', 'year_2', 2])
  })

  it('marks answers as the server would, once each, and adds them up', async () => {
    const grader = new PreviewGrader(SET)
    const right = await grader.answer('p', { item_id: 'q1', choice: 0, time_ms: 1 })
    expect([right.played.correct, right.played.reveal?.answer, right.streak]).toEqual([true, 0, 1])
    const again = await grader.answer('p', { item_id: 'q1', choice: 3, time_ms: 1 })
    expect(again.played.correct).toBe(true)
    const wrong = await grader.answer('p', { item_id: 'q2', choice: 0, time_ms: 1 })
    expect([wrong.played.correct, wrong.streak, wrong.answered]).toEqual([false, 0, 2])
    const finish = grader.finish(previewAttempt(SET))
    expect([finish.attempt.score, finish.attempt.percent, finish.stars, finish.attempt.status]).toEqual([1, 50, 1, 'completed'])
    expect(finish.skills).toEqual([
      { slug: 'light', label: 'Light energy', correct: 1, total: 1 },
      { slug: 'water', label: 'Water', correct: 0, total: 1 },
    ])
  })
})

function mount(level: PlayLevel) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
  const grader = new PreviewGrader(SET)
  render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <ToastProvider>
            <PlayLevelProvider value={level}>
              <PlayBackendProvider value={grader}>
                <QuizPlayer attempt={previewAttempt(SET)} buddy={createRef<BuddyHandle>()} exitTo="/" onFinished={vi.fn()} />
              </PlayBackendProvider>
            </PlayLevelProvider>
          </ToastProvider>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('a quiz in each look', () => {
  it('gives the youngest a star path and a cheer in their own words', async () => {
    mount('little')
    const progress = screen.getByRole('progressbar')
    expect(progress.querySelectorAll('svg')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: /Sunlight/ }))
    expect(await screen.findByText(/Yay! You got it!|Woohoo!|Super star!|You did it!/)).toBeInTheDocument()
  })

  it('keeps the Form look as it was: the bar, and "Correct!"', async () => {
    mount('senior')
    expect(screen.getByRole('progressbar').querySelectorAll('svg')).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: /Sunlight/ }))
    expect(await screen.findByText('Correct!')).toBeInTheDocument()
    expect(screen.queryByLabelText(/points/)).toBeNull()
  })

  it('gives Year 4–6 points to win', async () => {
    mount('middle')
    await userEvent.click(screen.getByRole('button', { name: /Sunlight/ }))
    expect(await screen.findByLabelText('10 points')).toBeInTheDocument()
  })
})
