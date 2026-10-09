/**
 * Revising a game (§26.8): the Streak Ladder climbs a rung for each right
 * answer and stops at the first slip; Tug-of-War pulls the rope toward the
 * team that answered right first, freezes a team that answered wrong, and
 * ends at five steps.
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Question } from './questions'
import { StreakLadder } from './StreakLadder'
import { PULLED_MS, TugOfWar } from './TugOfWar'

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

const identity = <T,>(items: readonly T[]) => [...items]

const question = (n: number, level = 1): Question => ({
  id: `q${n}`, ask: `What is ${n} + ${n}?`, options: [String(2 * n), String(2 * n + 1), String(2 * n + 2)], answer: 0, why: `${n} and ${n} make ${2 * n}.`, level,
})  // fmt: skip

describe('the Streak Ladder', () => {
  it('climbs a rung for each right answer and stops at the first slip', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(<StreakLadder title="Sums" questions={[question(3, 3), question(1, 1), question(2, 2)]} calm onExit={onExit} shuffle={identity} />)
    // Easiest first.
    expect(screen.getByText('What is 1 + 1?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(await screen.findByRole('button', { name: '4' }))
    expect(screen.getByRole('complementary', { name: 'Rung 2 of 3' })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: '7' }))
    expect(await screen.findByText('You climbed 2 rungs!')).toBeInTheDocument()
    expect(screen.getByText('The answer: 6')).toBeInTheDocument()
    expect(screen.getByText('3 and 3 make 6.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Play again/ }))
    expect(await screen.findByText('What is 1 + 1?')).toBeInTheDocument()
    expect(screen.getByText('Best 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close the Streak Ladder' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})

describe('Tug-of-War', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  const questions = Array.from({ length: 8 }, (_, n) => question(n + 1))
  const next = () => act(() => vi.advanceTimersByTime(PULLED_MS + 50))

  it('pulls toward the team that answers right first, and freezes a team that answers wrong', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<TugOfWar title="Sums" questions={questions} calm onExit={() => {}} shuffle={identity} />)
    expect(screen.getByRole('region', { name: 'The rope: in the middle' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Team Kancil: 3' }))
    expect(screen.getByRole('button', { name: 'Team Kancil: 2' })).toBeDisabled()
    expect(screen.getByText('Frozen!')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Team Harimau: 2' }))
    expect(screen.getByRole('region', { name: 'The rope: 1 step toward Team Harimau' })).toBeInTheDocument()
    expect(screen.getByText('Team Harimau pulls!')).toBeInTheDocument()

    next()
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Team Kancil: 4' })).toBeEnabled()
  })

  it('is won by the first team to pull the rope five steps', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<TugOfWar title="Sums" questions={questions} calm onExit={() => {}} shuffle={identity} />)
    for (let n = 1; n <= 5; n += 1) {
      await user.click(screen.getByRole('button', { name: `Team Kancil: ${2 * n}` }))
      next()
    }
    expect(screen.getByText(/Team Kancil wins!/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Play again/ }))
    expect(screen.getByRole('region', { name: 'The rope: in the middle' })).toBeInTheDocument()
  })
})
