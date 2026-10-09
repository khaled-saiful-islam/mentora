/**
 * Boss Battle (§26.8): a right answer hits the boss, a wrong one costs a heart
 * and the question comes back later, the hearts come back when they run out,
 * Show me answers one, and the battle ends exactly once.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BossBattle } from './BossBattle'
import type { BossContent } from './types'

const identity = <T,>(items: readonly T[]) => [...items]

const BOSS: BossContent = {
  name: 'Gergasi Garam',
  icon: '🧂',
  questions: [
    { id: 'q1', ask: 'What does an acid taste like?', options: ['Sour', 'Sweet', 'Bitter'], answer: 0, why: 'Acids taste sour, like lemon juice.' },
    { id: 'q2', ask: 'What is the pH of pure water?', options: ['1', '7', '14'], answer: 1, why: 'Pure water is neutral: pH 7.' },
  ],
}

function mount(showMe = 0) {
  const calls = { say: vi.fn(), sound: vi.fn(), onMove: vi.fn(), onDone: vi.fn() }
  const props = { content: BOSS, band: 'middle' as const, calm: true, showMe, shuffle: identity, ...calls }
  const view = render(<BossBattle {...props} />)
  return { ...calls, showMe: (n: number) => view.rerender(<BossBattle {...props} showMe={n} />) }
}

describe('Boss Battle', () => {
  it('hits the boss for a right answer and ends once every question is beaten', async () => {
    const user = userEvent.setup()
    const round = mount()
    expect(screen.getByRole('region', { name: 'Gergasi Garam: health 2 of 2' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sour' }))
    expect(round.onMove).toHaveBeenLastCalledWith({ piece: 'q1', right: true })
    expect(round.sound).toHaveBeenLastCalledWith('correct')
    expect(screen.getByRole('region', { name: 'Gergasi Garam: health 1 of 2' })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: '7' }))
    expect(await screen.findByText('Gergasi Garam is beaten!')).toBeInTheDocument()
    expect(round.onDone).toHaveBeenCalledTimes(1)
  })

  it('costs a heart for a wrong answer, says why, and asks it again later', async () => {
    const user = userEvent.setup()
    const round = mount()
    await user.click(screen.getByRole('button', { name: 'Sweet' }))
    expect(round.say).toHaveBeenCalledWith('Acids taste sour, like lemon juice.')
    expect(round.onMove).toHaveBeenLastCalledWith({ piece: 'q1', right: false })
    expect(round.sound).toHaveBeenLastCalledWith('wrong')
    expect(screen.getByLabelText('Your hearts: 2 of 3')).toBeInTheDocument()
    // The next question first; the missed one comes back after it.
    await user.click(await screen.findByRole('button', { name: '7' }))
    await user.click(await screen.findByRole('button', { name: 'Sour' }))
    expect(round.onDone).toHaveBeenCalledTimes(1)
  })

  it('never ends the game: out of hearts, the buddy brings them back', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Sweet' }))
    await user.click(await screen.findByRole('button', { name: '1' }))
    await user.click(await screen.findByRole('button', { name: 'Bitter' }))
    expect(screen.getByLabelText('Your hearts: 3 of 3')).toBeInTheDocument()
    expect(screen.getByText('Your buddy brings the hearts back!')).toBeInTheDocument()
  })

  it('plays the right answer itself on Show me, without counting a move', async () => {
    const round = mount()
    round.showMe(1)
    await waitFor(() => expect(screen.getByRole('region', { name: 'Gergasi Garam: health 1 of 2' })).toBeInTheDocument(), { timeout: 2000 })
    expect(round.onMove).not.toHaveBeenCalled()
    round.showMe(2)
    await waitFor(() => expect(round.onDone).toHaveBeenCalledTimes(1), { timeout: 2000 })
  })
})
