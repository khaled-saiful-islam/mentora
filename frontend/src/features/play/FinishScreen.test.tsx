/**
 * The end of a game (§23): the points it was worth, counted by the server,
 * and how they stand against the player's best — "Play again" to beat it —
 * and a replay of just the missions it missed, in the real game.
 */
import { act, render, screen } from '@testing-library/react'
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

const mission = (id: string, goal: string) => ({ id, goal, has_hint: true, skill: 'water', difficulty: 'easy' })

const played = (item_id: string, correct: boolean) => ({
  item_id, choice: null, knew: null, correct, reveal: { explanation: `Heat turns water into gas (${item_id}).` },
})

/** A message from the game in its frame, as its runtime sends it. */
function fromGame(data: Record<string, unknown>) {
  const frame = document.querySelector('iframe')!
  window.dispatchEvent(new MessageEvent('message', { data: { source: 'mentora-game', ...data }, source: frame.contentWindow }))
}

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

  it('replays just the missions missed, in the real game, and keeps nothing', async () => {
    const user = userEvent.setup()
    mount(finished({
      items: [mission('g1', 'Reached first time.'), mission('g2', 'Missed this one.'), mission('g3', 'And this one.')],
      answered: [played('g1', true), played('g2', false), played('g3', false)],
    }))
    await user.click(screen.getByRole('button', { name: 'Missions you missed (2)' }))
    const frame = screen.getByTitle(/The game/) as HTMLIFrameElement
    expect(frame.getAttribute('src')).toBe('/api/me/attempts/a1/game?only=g2%2Cg3')
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
    expect(screen.getAllByRole('listitem', { name: /^Mission/ })).toHaveLength(2)

    act(() => fromGame({ type: 'ready' }))
    act(() => fromGame({ type: 'done', id: 'g2', tries: 2 }))
    expect(await screen.findByRole('dialog', { name: 'What you discovered' })).toHaveTextContent('Heat turns water into gas (g2).')
    await user.click(screen.getByRole('button', { name: /Keep going/ }))
    act(() => fromGame({ type: 'done', id: 'g3', tries: 1 }))
    await user.click(await screen.findByRole('button', { name: /To the finish/ }))
    await user.click(await screen.findByRole('button', { name: /Back to my score/ }))
    expect(screen.getByText('640 points')).toBeInTheDocument()
    // A replay is not an attempt: nothing was sent to be kept.
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/answers'))).toBe(false)
  })

  it('offers no replay when every mission was reached', () => {
    mount(finished({ items: [mission('g1', 'Easy.')], answered: [played('g1', true)] }))
    expect(screen.queryByRole('button', { name: /Missions you missed/ })).not.toBeInTheDocument()
  })
})
