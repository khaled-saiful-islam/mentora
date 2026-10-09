/**
 * Editing The Lab and a Detective Case (§26.8): the formula checked as it is
 * typed, and the answer and its proof kept pointing at pieces that exist.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CaseContent, LabContent } from '@/features/game/rounds/types'
import { CaseEditor } from './case'
import { LabEditor } from './lab'

const LAB: LabContent = {
  controls: [{ id: 'light', label: 'Sunlight', icon: '☀️', unit: '%', min: 0, max: 100, step: 10, start: 30 }],
  output: { label: 'Food made', icon: '🍬', unit: 'g', min: 0, max: 200 },
  formula: 'light * 2',
  goals: [{ id: 'g1', text: 'Make 100 g', low: 100, high: 140, why: 'More light.', solution: { light: 60 } }],
}

const CASE: CaseContent = {
  question: 'Which car was too fast?',
  clues: ['k1', 'k2', 'k3'].map((id, n) => ({ id, title: `Clue ${id}`, icon: '🔎', text: `Text ${n}`, rows: [], why: 'So.' })),
  suspects: [
    { id: 'red', name: 'Red car', icon: '🚗', claim: 'Not me.', why: 'It was.' },
    { id: 'blue', name: 'Blue car', icon: '🚙', claim: 'Slow.', why: 'It was not.' },
    { id: 'green', name: 'Green car', icon: '🚕', claim: 'Parked.', why: 'It was parked.' },
  ],
  answer: 'red',
  key: 'k2',
}

function Kept<C>({ start, Editor, seen }: { start: C; Editor: (p: { content: C; onChange: (c: C) => void }) => React.ReactNode; seen: (c: C) => void }) {
  const [content, setContent] = useState(start)
  return (
    <Editor
      content={content}
      onChange={(next) => {
        seen(next)
        setContent(next)
      }}
    />
  )
}

describe('the Lab editor', () => {
  it('checks the formula as it is typed, with the sliders where they start', () => {
    const seen = vi.fn()
    render(<Kept start={LAB} Editor={LabEditor} seen={seen} />)
    expect(screen.getByRole('status')).toHaveTextContent('it gives 60 g')
    fireEvent.change(screen.getByLabelText('The formula'), { target: { value: 'light * ' } })
    expect(screen.getByRole('status')).toHaveTextContent("can't be worked out")
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ formula: 'light * ', goals: LAB.goals }))
  })
})

describe('the Detective Case editor', () => {
  it('keeps the answer on a suspect that is still there', async () => {
    const seen = vi.fn()
    const user = userEvent.setup()
    render(<Kept start={CASE} Editor={CaseEditor} seen={seen} />)
    await user.click(screen.getByRole('button', { name: 'Remove suspect 1' }))
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ answer: 'blue' }))
    await user.click(screen.getAllByRole('button', { name: 'Add a table' })[0])
    await user.click(screen.getByRole('button', { name: 'Add a column' }))
    expect(seen.mock.lastCall?.[0].clues[0].rows).toEqual([['', '', ''], ['', '', '']])
  })
})
