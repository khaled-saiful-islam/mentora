/**
 * The Lab and Detective Case (§26.8): a goal reached by holding the output in
 * its zone, a let-go outside it answered with why (once, as one slip), Show me
 * sliding to the answer; and a case solved by the right pick, then the clue
 * that proves it — wrong picks counted, tables read as tables.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DetectiveCase } from './DetectiveCase'
import { HOLD_MS, TheLab } from './TheLab'
import type { CaseContent, LabContent } from './types'

const identity = <T,>(items: readonly T[]) => [...items]

const LAB: LabContent = {
  controls: [{ id: 'light', label: 'Sunlight', icon: '☀️', unit: '%', min: 0, max: 100, step: 10, start: 0 }],
  output: { label: 'Food made', icon: '🍬', unit: 'g', min: 0, max: 200 },
  formula: 'light * 2',
  goals: [
    { id: 'g1', text: 'Make 100 to 140 g of food', low: 100, high: 140, why: 'More light lets the leaf make more food.', solution: { light: 60 } },
    { id: 'g2', text: 'Make the most food you can', low: 180, high: 200, why: 'Full light makes the most food.', solution: { light: 100 } },
  ],
}

const CASE: CaseContent = {
  question: 'Which car broke the speed limit of 60 km/h?',
  clues: [
    { id: 'k1', title: 'The traffic camera', icon: '📷', text: 'Each car was timed over 100 m.', rows: [['Car', 'Time (s)'], ['Red', '5'], ['Blue', '8']], why: 'It gives times, not the rule.' },
    { id: 'k2', title: 'The speed sums', icon: '🧮', text: 'Speed is distance over time.', rows: [], why: '100 m in 5 s is 72 km/h.' },
    { id: 'k3', title: 'The weather', icon: '🌧️', text: 'It was raining.', rows: [], why: 'Rain does not change a speed.' },
  ],
  suspects: [
    { id: 'red', name: 'The red car', icon: '🚗', claim: 'I was careful.', why: '100 m in 5 s is 72 km/h: too fast.' },
    { id: 'blue', name: 'The blue car', icon: '🚙', claim: 'I was slow.', why: '100 m in 8 s is 45 km/h: under the limit.' },
  ],
  answer: 'red',
  key: 'k2',
}

function calls() {
  return { say: vi.fn(), sound: vi.fn(), onMove: vi.fn(), onDone: vi.fn() }
}

afterEach(() => vi.useRealTimers())

describe('The Lab', () => {
  function mount() {
    const fns = calls()
    const props = { content: LAB, band: 'secondary' as const, calm: true, showMe: 0, ...fns }
    const view = render(<TheLab {...props} />)
    const showMe = (n: number) => view.rerender(<TheLab {...props} showMe={n} />)
    return { ...fns, showMe, slider: () => screen.getByRole('slider', { name: /Sunlight/ }) }
  }

  it('reaches a goal once the output holds in its zone, and says why when let go short of it', () => {
    vi.useFakeTimers()
    const lab = mount()
    expect(screen.getByText('Goal 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'How Food made changes with Sunlight' })).toBeInTheDocument()

    fireEvent.change(lab.slider(), { target: { value: '20' } })
    fireEvent.pointerUp(lab.slider())
    expect(lab.say).toHaveBeenCalledWith('More light lets the leaf make more food.')
    expect(lab.onMove).toHaveBeenLastCalledWith({ piece: 'g1', right: false })
    expect(screen.getByText('A bit higher!')).toBeInTheDocument()
    // Again at once: no second why so soon, and still one slip for this goal.
    fireEvent.pointerUp(lab.slider())
    act(() => void vi.advanceTimersByTime(5000))
    fireEvent.pointerUp(lab.slider())
    expect(lab.say).toHaveBeenCalledTimes(2)
    expect(lab.onMove).toHaveBeenCalledTimes(1)

    fireEvent.change(lab.slider(), { target: { value: '60' } })
    expect(screen.getByRole('meter', { name: 'Food made' })).toHaveAttribute('aria-valuetext', '120 g')
    act(() => void vi.advanceTimersByTime(HOLD_MS - 100))
    expect(screen.getByText('Goal 1 of 2')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(200))
    expect(lab.onMove).toHaveBeenLastCalledWith({ piece: 'g1', right: true })
    expect(lab.sound).toHaveBeenLastCalledWith('correct')
    expect(screen.getByText('Goal 2 of 2')).toBeInTheDocument()
    expect(screen.getByText('Goal reached!')).toBeInTheDocument()
  })

  it('slides to the answer on Show me, and finishes once', () => {
    vi.useFakeTimers()
    const lab = mount()
    lab.showMe(1)
    act(() => void vi.advanceTimersByTime(2000))
    expect(lab.slider()).toHaveValue('60')
    act(() => void vi.advanceTimersByTime(HOLD_MS + 100))
    expect(screen.getByText('Goal 2 of 2')).toBeInTheDocument()

    lab.showMe(2)
    act(() => void vi.advanceTimersByTime(2000))
    act(() => void vi.advanceTimersByTime(HOLD_MS + 100))
    expect(screen.getByText('Every goal reached!')).toBeInTheDocument()
    expect(lab.onDone).toHaveBeenCalledTimes(1)
    lab.showMe(3)
    act(() => void vi.advanceTimersByTime(3000))
    expect(lab.onDone).toHaveBeenCalledTimes(1)
  })

  it('shows a dash, never a goal, for an output it cannot work out', () => {
    vi.useFakeTimers()
    const lab = render(<TheLab content={{ ...LAB, formula: '100 / (light - 50) + 120' }} band="middle" calm showMe={0} {...calls()} />)
    fireEvent.change(screen.getByRole('slider', { name: /Sunlight/ }), { target: { value: '50' } })
    act(() => void vi.advanceTimersByTime(HOLD_MS * 2))
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '— g')
    expect(screen.getByText('Goal 1 of 2')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument() // no graph below Form 1
    lab.unmount()
  })
})

describe('Detective Case', () => {
  function mount() {
    const fns = calls()
    const props = { content: CASE, band: 'secondary' as const, calm: true, showMe: 0, shuffle: identity, ...fns }
    const view = render(<DetectiveCase {...props} />)
    const showMe = (n: number) => view.rerender(<DetectiveCase {...props} showMe={n} />)
    return { ...fns, showMe }
  }

  it('is solved by the right pick and then the clue that proves it', async () => {
    const user = userEvent.setup()
    const round = mount()
    await user.click(screen.getByRole('button', { name: /^Pick The blue car/ }))
    expect(round.say).toHaveBeenCalledWith('100 m in 8 s is 45 km/h: under the limit.')
    expect(round.onMove).toHaveBeenLastCalledWith({ piece: 'blue', right: false })

    // A clue opens to its words and its table — headings and all.
    await user.click(screen.getByRole('button', { name: /The traffic camera/ }))
    const table = within(screen.getByRole('article', { name: 'Clue 1: The traffic camera' })).getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Car', 'Time (s)'])
    expect(within(table).getAllByRole('row')).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: /^Pick The red car/ }))
    expect(round.onMove).toHaveBeenLastCalledWith({ piece: 'red', right: true })
    expect(screen.getByText('Which clue proves it?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /The red car: it is this one/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'This clue proves it: The weather' }))
    expect(round.say).toHaveBeenLastCalledWith('Rain does not change a speed.')
    expect(round.onMove).toHaveBeenLastCalledWith({ piece: 'k3', right: false })
    expect(round.onDone).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'This clue proves it: The speed sums' }))
    expect(round.onMove).toHaveBeenLastCalledWith({ piece: 'k2', right: true })
    expect(screen.getByText('Case closed!')).toBeInTheDocument()
    expect(round.onDone).toHaveBeenCalledTimes(1)
  })

  it('shows one right pick per press of Show me', () => {
    vi.useFakeTimers()
    const round = mount()
    round.showMe(1)
    act(() => void vi.advanceTimersByTime(1500))
    expect(screen.getByText('Which clue proves it?')).toBeInTheDocument()
    expect(round.say).toHaveBeenLastCalledWith('100 m in 5 s is 72 km/h: too fast.')
    expect(round.onDone).not.toHaveBeenCalled()

    round.showMe(2)
    act(() => void vi.advanceTimersByTime(1500))
    expect(screen.getByText('Case closed!')).toBeInTheDocument()
    expect(round.onMove).not.toHaveBeenCalled() // the buddy's picks, not the child's
    expect(round.onDone).toHaveBeenCalledTimes(1)
  })
})
