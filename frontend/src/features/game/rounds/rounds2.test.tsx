/**
 * The templates of §26.8 — the rebuilt Match Up, Spot the Mistake and Escape
 * Room: a right move, a wrong one (the buddy says why, and it counts as a
 * slip), Show me playing a move that is not the child's, and the round
 * finishing exactly once.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EscapeRoom, sameCode } from './EscapeRoom'
import { MatchUp } from './MatchUp'
import { SpotTheMistake } from './SpotTheMistake'
import type { EscapeContent, MatchContent, MistakeContent, RoundProps } from './types'

const identity = <T,>(items: readonly T[]) => [...items]

function calls() {
  return { say: vi.fn(), sound: vi.fn(), onMove: vi.fn(), onDone: vi.fn() }
}

function base<C>(content: C, fns: ReturnType<typeof calls>): RoundProps<C> & { shuffle: typeof identity } {
  return { content, band: 'middle', calm: true, showMe: 0, shuffle: identity, ...fns }
}

const MATCH: MatchContent = {
  pairs: [
    { id: 'p1', left: 'Roots', right: 'drink water', why: 'Roots take in water from the soil.' },
    { id: 'p2', left: 'Leaves', right: 'catch light', why: 'Leaves catch the sunlight.' },
    { id: 'p3', left: 'Stem', right: 'holds it up', why: 'The stem holds the plant up.' },
  ],
}

const MISTAKE: MistakeContent = {
  title: "Ali's working",
  lines: [
    { id: 'l1', text: '2 + 3 = 5', wrong: false, fix: '', decoys: [], why: 'Two and three make five.' },
    { id: 'l2', text: '5 × 4 = 9', wrong: true, fix: '5 × 4 = 20', decoys: ['5 × 4 = 25'], why: 'Five lots of four is twenty, not nine.' },
    { id: 'l3', text: 'So the answer is 20', wrong: false, fix: '', decoys: [], why: 'It follows from the line before.' },
  ],
}

const ESCAPE: EscapeContent = {
  doors: [
    { id: 'd1', puzzle: 'What is 6 × 7?', icon: '🔢', kind: 'number', answer: '42', options: [], why: 'Six lots of seven make 42.' },
    { id: 'd2', puzzle: 'Boiling water turns to…', icon: '♨️', kind: 'word', answer: 'steam', options: [], why: 'Boiling water becomes steam.' },
    { id: 'd3', puzzle: 'Which one is an acid?', icon: '🧪', kind: 'choice', answer: 'Vinegar', options: ['Soap', 'Vinegar', 'Chalk'], why: 'Vinegar is sour: an acid.' },
  ],
}

describe('Match Up', () => {
  it('marks a picked answer, and a wrong slot sends it back to the tray', async () => {
    const user = userEvent.setup()
    const fns = calls()
    render(<MatchUp {...base(MATCH, fns)} />)
    const chip = screen.getByRole('button', { name: 'catch light' })
    await user.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: "Slot for 'Stem'" }))
    expect(fns.say).toHaveBeenCalledWith('The stem holds the plant up.')
    expect(fns.onMove).toHaveBeenLastCalledWith({ piece: 'p3', right: false })
    expect(screen.getByRole('button', { name: 'catch light' })).toHaveAttribute('aria-pressed', 'false')

    for (const pair of MATCH.pairs) {
      await user.click(screen.getByRole('button', { name: pair.right }))
      await user.click(screen.getByRole('button', { name: `Slot for '${pair.left}'` }))
    }
    expect(screen.getByText('All matched!')).toBeInTheDocument()
    expect(fns.onDone).toHaveBeenCalledTimes(1)
  })

  it('reads each side to the youngest', async () => {
    const user = userEvent.setup()
    const fns = calls()
    render(<MatchUp {...base(MATCH, fns)} band="early" />)
    await user.click(screen.getByRole('button', { name: 'Read it to me: Roots' }))
    await user.click(screen.getByRole('button', { name: 'Read it to me: drink water' }))
    expect(fns.say.mock.calls).toEqual([['Roots'], ['drink water']])
    expect(fns.onMove).not.toHaveBeenCalled()
  })
})

describe('Spot the Mistake', () => {
  it('answers a doubted right line, then fixes the wrong one', async () => {
    const user = userEvent.setup()
    const fns = calls()
    render(<SpotTheMistake {...base(MISTAKE, fns)} />)
    expect(screen.getByText('1 mistake to find')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Line 1: 2 + 3 = 5' }))
    expect(fns.say).toHaveBeenLastCalledWith('Two and three make five.')
    expect(fns.onMove).toHaveBeenLastCalledWith({ piece: 'l1', right: false })
    expect(screen.getByText('This one is right')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Line 2: 5 × 4 = 9' }))
    expect(screen.getByText('Which is right?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '5 × 4 = 25' }))
    expect(fns.onMove).toHaveBeenLastCalledWith({ piece: 'l2', right: false })
    expect(fns.say).toHaveBeenLastCalledWith('Five lots of four is twenty, not nine.')

    await user.click(screen.getByRole('button', { name: '5 × 4 = 20' }))
    expect(fns.onMove).toHaveBeenLastCalledWith({ piece: 'l2', right: true })
    expect(screen.getByRole('button', { name: 'Line 2, fixed: 5 × 4 = 20' })).toBeDisabled()
    expect(screen.getByText('Every mistake fixed!')).toBeInTheDocument()
    expect(fns.onDone).toHaveBeenCalledTimes(1)
  })

  it('lets Show me fix a mistake, which is not the child’s move', async () => {
    const fns = calls()
    const props = base(MISTAKE, fns)
    const view = render(<SpotTheMistake {...props} />)
    view.rerender(<SpotTheMistake {...props} showMe={1} />)
    await waitFor(() => expect(fns.onDone).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(fns.onMove).not.toHaveBeenCalled()
  })
})

describe('Escape Room', () => {
  it('opens each door with its code: a keypad, letter tiles, a choice', async () => {
    const user = userEvent.setup()
    const fns = calls()
    render(<EscapeRoom {...base(ESCAPE, fns)} />)
    expect(screen.getByText('Door 1 of 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Type 4' }))
    await user.click(screen.getByRole('button', { name: 'Type 1' }))
    await user.click(screen.getByRole('button', { name: /Open/ }))
    expect(fns.onMove).toHaveBeenLastCalledWith({ piece: 'd1', right: false })
    expect(fns.say).toHaveBeenLastCalledWith('Six lots of seven make 42.')
    expect(screen.getByLabelText('The code')).toHaveTextContent('?')

    await user.click(screen.getByRole('button', { name: 'Type 4' }))
    await user.click(screen.getByRole('button', { name: 'Type 2' }))
    await user.click(screen.getByRole('button', { name: /Open/ }))
    expect(fns.onMove).toHaveBeenLastCalledWith({ piece: 'd1', right: true })
    expect(screen.getByText('Door 2 of 3')).toBeInTheDocument()

    // A tile given back is a tile to use again.
    await user.click(screen.getByRole('button', { name: 'Letter I' }))
    await user.click(screen.getByRole('button', { name: 'Give back I' }))
    for (const letter of 'STEAM') await user.click(screen.getByRole('button', { name: `Letter ${letter}` }))
    await user.click(screen.getByRole('button', { name: /Open/ }))
    expect(fns.onMove).toHaveBeenLastCalledWith({ piece: 'd2', right: true })

    await user.click(screen.getByRole('button', { name: 'Vinegar' }))
    expect(fns.onMove).toHaveBeenLastCalledWith({ piece: 'd3', right: true })
    expect(screen.getByText('You escaped!')).toBeInTheDocument()
    expect(fns.onDone).toHaveBeenCalledTimes(1)
  })

  it('lets Show me type a door’s code and open it', async () => {
    const fns = calls()
    const props = base(ESCAPE, fns)
    const view = render(<EscapeRoom {...props} />)
    view.rerender(<EscapeRoom {...props} showMe={1} />)
    expect(await screen.findByText('Door 2 of 3', undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(fns.onMove).not.toHaveBeenCalled()
  })

  it('reads a code the way a child might write it', () => {
    expect(sameCode('3/4', '0.75')).toBe(true)
    expect(sameCode(' Steam ', 'steam')).toBe(true)
    expect(sameCode('-2', '-2.0')).toBe(true)
    expect(sameCode('42', '24')).toBe(false)
    expect(sameCode('1/0', '1/0')).toBe(true)
  })
})
