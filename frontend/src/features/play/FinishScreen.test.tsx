/**
 * The end of a game (§23): the points it was worth, counted by the server,
 * and how they stand against the player's best — "Play again" to beat it —
 * and a calm round of the tricky ones it missed.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import type { Attempt, Finish } from './api'
import { FinishScreen } from './FinishScreen'
import { PlayLevelProvider } from './level'

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))
afterEach(() => vi.unstubAllGlobals())

function finished(over: Partial<Attempt>): Finish {
  const attempt = {
    id: 'a1', status: 'completed', number: 1, title: 'Rescue at the River', kind: 'game', purpose: 'assign', feedback_mode: 'instant',
    assignment_id: 'as1', set_id: 's1', items: [], answered: [], skills: [], extras: {}, language: 'en',
    score: 7, max_score: 9, percent: 77.78, best_streak: 4, can_retake: true, attempts_used: 1, leaderboard: false, due_at: null,
    points: 640, best_points: 640, ...over,
  } as Attempt
  return { attempt, stars: 2, skills: [], badges: [], rank: null, ranked: 0 }
}

function mount(finish: Finish) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
  render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <PlayLevelProvider value="middle">
            <FinishScreen finish={finish} onReview={() => {}} onRetake={() => {}} leaderboardTo={null} />
          </PlayLevelProvider>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

const challenge = (id: string, prompt: string) => ({ id, prompt, options: ['Evaporation', 'Condensation', 'Melting'], has_hint: true, skill: 'water', difficulty: 'easy' })

const played = (item_id: string, choice: number | null, correct: boolean) => ({
  item_id, choice, knew: null, correct, reveal: { answer: 0, explanation: `Heat turns water into gas (${item_id}).` },
})

describe('the end of a game', () => {
  it('shows the points the server counted, and offers to play again', () => {
    mount(finished({}))
    expect(screen.getByText('640 points')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Play again/ })).toBeInTheDocument()
    // A first game has no best to beat yet, and no quiz-style points either.
    expect(screen.queryByText(/Your best/)).not.toBeInTheDocument()
    expect(screen.queryByText(/You won/)).not.toBeInTheDocument()
  })

  it('cheers a replay that matches or beats the best', async () => {
    mount(finished({ attempts_used: 3, points: 880, best_points: 880 }))
    expect(await screen.findByText('Your best yet!')).toBeInTheDocument()
  })

  it('shows the best still to beat after a lower replay', () => {
    mount(finished({ attempts_used: 2, points: 420, best_points: 880 }))
    expect(screen.getByText('Your best: 880 points')).toBeInTheDocument()
    expect(screen.queryByText('Your best yet!')).not.toBeInTheDocument()
  })

  it('replays only the missed and timed-out challenges, calmly, then goes back to the score', async () => {
    const user = userEvent.setup()
    mount(finished({
      items: [challenge('g1', 'Right first time?'), challenge('g2', 'Missed this one?'), challenge('g3', 'Ran out of time?')],
      answered: [played('g1', 0, true), played('g2', 1, false), played('g3', null, false)],
    }))
    await user.click(screen.getByRole('button', { name: 'Tricky ones (2)' }))
    expect(screen.getByText('No timer, no points — just another go.')).toBeInTheDocument()
    expect(screen.getByText('Missed this one?')).toBeInTheDocument()
    expect(screen.queryByText('Right first time?')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Option 1: Evaporation' }))
    expect(await screen.findByRole('status', { name: 'How it went' })).toHaveTextContent('Heat turns water into gas (g2).')
    await user.click(screen.getByRole('button', { name: /Next one/ }))

    expect(screen.getByText('Ran out of time?')).toBeInTheDocument()
    await user.keyboard('2')
    expect(await screen.findByRole('status', { name: 'How it went' })).toHaveTextContent('The answer is Evaporation')
    await user.click(screen.getByRole('button', { name: /All done/ }))

    expect(screen.getByText('You got 1 of the 2 tricky ones this time.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Back to my score/ }))
    expect(screen.getByText('640 points')).toBeInTheDocument()
  })

  it('offers no tricky round when every challenge was right', () => {
    mount(finished({ items: [challenge('g1', 'Easy?')], answered: [played('g1', 0, true)] }))
    expect(screen.queryByRole('button', { name: /Tricky ones/ })).not.toBeInTheDocument()
  })
})
