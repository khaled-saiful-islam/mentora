/**
 * The three first templates (§26): a right move, a wrong one (the buddy says
 * why, and it counts as a slip), Show me playing one right move, and the round
 * finishing exactly once.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { bandOf, Round, type AnyRound, type MatchContent, type OrderContent, type SortContent } from '.'

const identity = <T,>(items: readonly T[]) => [...items]
const reverse = <T,>(items: readonly T[]) => [...items].reverse()

const SORT: SortContent = {
  baskets: [
    { id: 'acid', label: 'Acids', icon: '🍋' },
    { id: 'base', label: 'Bases', icon: '🧼' },
  ],
  cards: [
    { id: 'c1', text: 'Vinegar', icon: '🫙', basket: 'acid', why: 'Vinegar tastes sour: it is an acid.' },
    { id: 'c2', text: 'Soap', icon: '🧼', basket: 'base', why: 'Soap feels slippery: it is a base.' },
    { id: 'c3', text: 'Lemon juice', icon: '🍋', basket: 'acid', why: 'Lemon juice is sour: an acid.' },
  ],
}

const ORDER: OrderContent = {
  steps: [
    { id: 's1', text: 'The sun heats the sea', icon: '☀️', why: 'First the water must warm up.' },
    { id: 's2', text: 'Vapour rises', icon: '💨', why: 'Vapour rises after the water is heated.' },
    { id: 's3', text: 'Clouds form', icon: '☁️', why: 'Clouds form once the vapour cools up high.' },
  ],
}

const MATCH: MatchContent = {
  pairs: [
    { id: 'p1', left: '1/2', right: 'one half', why: '1 of 2 equal parts is a half.' },
    { id: 'p2', left: '1/4', right: 'one quarter', why: '1 of 4 equal parts is a quarter.' },
    { id: 'p3', left: '3/4', right: 'three quarters', why: '3 of 4 equal parts.' },
  ],
}

function mount(round: Omit<AnyRound, 'band' | 'calm' | 'say' | 'sound' | 'showMe' | 'onMove' | 'onDone'>) {
  const calls = { say: vi.fn(), sound: vi.fn(), onMove: vi.fn(), onDone: vi.fn() }
  const props = { band: 'middle', calm: true, showMe: 0, ...calls, ...round } as AnyRound
  const view = render(<Round {...props} />)
  const showMe = (n: number) => view.rerender(<Round {...props} showMe={n} />)
  return { ...calls, showMe }
}

describe('Sort It Out', () => {
  it('sorts each card, says why a wrong basket is wrong, and finishes once', async () => {
    const user = userEvent.setup()
    const round = mount({ play: 'sort', content: SORT, shuffle: identity })
    expect(screen.getByText('Card 1 of 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: "Put 'Vinegar' in Bases" }))
    expect(round.say).toHaveBeenCalledWith('Vinegar tastes sour: it is an acid.')
    expect(round.onMove).toHaveBeenLastCalledWith({ piece: 'c1', right: false })
    expect(round.sound).toHaveBeenLastCalledWith('wrong')

    await user.click(screen.getByRole('button', { name: "Put 'Vinegar' in Acids" }))
    expect(round.onMove).toHaveBeenLastCalledWith({ piece: 'c1', right: true })
    expect(await screen.findByText('Card 2 of 3')).toBeInTheDocument()

    // Show me puts the soap in its basket — not one of the child's moves.
    round.showMe(1)
    expect(await screen.findByText('Card 3 of 3', undefined, { timeout: 3000 })).toBeInTheDocument()
    expect(round.onMove).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: "Put 'Lemon juice' in Acids" }))
    expect(screen.getByText('All sorted!')).toBeInTheDocument()
    round.showMe(2)
    expect(round.onDone).toHaveBeenCalledTimes(1)
  })
})

describe('Line Up', () => {
  it('locks the right next step, says why one comes later, and finishes once', async () => {
    const user = userEvent.setup()
    const round = mount({ play: 'order', content: ORDER, shuffle: reverse })

    await user.click(screen.getByRole('button', { name: "Put 'Vapour rises' first" }))
    expect(round.say).toHaveBeenCalledWith('Vapour rises after the water is heated.')
    expect(round.onMove).toHaveBeenLastCalledWith({ piece: 's2', right: false })

    await user.click(screen.getByRole('button', { name: "Put 'The sun heats the sea' first" }))
    expect(round.onMove).toHaveBeenLastCalledWith({ piece: 's1', right: true })
    expect(screen.getByLabelText('Step 1: The sun heats the sea')).toBeInTheDocument()

    round.showMe(1)
    expect(await screen.findByLabelText('Step 2: Vapour rises', undefined, { timeout: 3000 })).toBeInTheDocument()
    expect(round.onMove).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: "Put 'Clouds form' next" }))
    expect(screen.getByText('All in order!')).toBeInTheDocument()
    expect(round.onDone).toHaveBeenCalledTimes(1)
  })

  it('never starts in order, whatever the shuffle', () => {
    mount({ play: 'order', content: ORDER, shuffle: identity })
    const names = screen.getAllByRole('button', { name: /^Put / }).map((b) => b.getAttribute('aria-label'))
    expect(names[0]).not.toBe("Put 'The sun heats the sea' first")
  })
})

describe('Match Up', () => {
  it('joins pairs from either side, says why a wrong pair is wrong, and Show me can finish it', async () => {
    const user = userEvent.setup()
    const round = mount({ play: 'match', content: MATCH, shuffle: identity })

    await user.click(screen.getByRole('button', { name: '1/2' }))
    expect(screen.getByText("Now find the partner of '1/2'")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'one quarter' }))
    expect(round.say).toHaveBeenCalledWith('1 of 2 equal parts is a half.')
    expect(round.onMove).toHaveBeenLastCalledWith({ piece: 'p1', right: false })

    await user.click(screen.getByRole('button', { name: '1/2' }))
    await user.click(screen.getByRole('button', { name: 'one half' }))
    expect(round.onMove).toHaveBeenLastCalledWith({ piece: 'p1', right: true })
    expect(screen.getByRole('button', { name: /1\/2/ })).toBeDisabled()

    // Right side first, then its partner.
    await user.click(screen.getByRole('button', { name: 'one quarter' }))
    await user.click(screen.getByRole('button', { name: '1/4' }))
    expect(round.onMove).toHaveBeenLastCalledWith({ piece: 'p2', right: true })

    round.showMe(1)
    await waitFor(() => expect(round.onDone).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(screen.getByText('All matched!')).toBeInTheDocument()
    expect(round.onMove).toHaveBeenCalledTimes(3)
  })
})

describe('the year bands', () => {
  it('reads a set year as early, middle or secondary', () => {
    expect(bandOf('year_2')).toBe('early')
    expect(bandOf('year_5')).toBe('middle')
    expect(bandOf('form_4')).toBe('secondary')
    expect(bandOf(null)).toBe('middle')
  })

  it('gives the youngest a read-aloud button on the card', async () => {
    const user = userEvent.setup()
    const round = mount({ play: 'sort', content: SORT, shuffle: identity, band: 'early' } as Omit<AnyRound, 'calm' | 'say' | 'sound' | 'showMe' | 'onMove' | 'onDone'>)
    await user.click(screen.getByRole('button', { name: 'Read it to me: Vinegar' }))
    expect(round.say).toHaveBeenCalledWith('Vinegar')
    expect(round.onMove).not.toHaveBeenCalled()
  })
})
