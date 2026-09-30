import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DateTimeField, firstGuess, localFromIso, localValue, monthGrid, parseLocal } from './DateTimeField'

describe('the times a picker works in', () => {
  it('reads and writes local time, to the minute', () => {
    const at = new Date(2026, 9, 1, 15, 5)
    expect(localValue(at)).toBe('2026-10-01T15:05')
    expect(parseLocal('2026-10-01T15:05')?.getTime()).toBe(at.getTime())
    expect(parseLocal('')).toBeNull()
    expect(localFromIso(at.toISOString())).toBe('2026-10-01T15:05')
    expect(localFromIso(null)).toBe('')
  })

  it('lays a month out in whole weeks from Monday', () => {
    const october = monthGrid(2026, 9)
    // 1 October 2026 is a Thursday: three blanks first.
    expect(october.slice(0, 4).map((d) => d?.getDate() ?? null)).toEqual([null, null, null, 1])
    expect(october.length % 7).toBe(0)
  })

  it('starts on the next whole hour, never before the earliest allowed', () => {
    const now = new Date(2026, 9, 1, 14, 23)
    expect(localValue(firstGuess(null, now))).toBe('2026-10-01T15:00')
    expect(localValue(firstGuess(new Date(2026, 9, 3, 9, 30), now))).toBe('2026-10-03T10:00')
  })
})

function Harness({ onChange, start = '' }: { onChange: (v: string) => void; start?: string }) {
  const [value, setValue] = useState(start)
  return (
    <DateTimeField
      id="due"
      value={value}
      min="2026-01-01T08:00"
      onChange={(v) => {
        setValue(v)
        onChange(v)
      }}
    />
  )
}

describe('picking a date and time', () => {
  it('changes nothing until OK, then closes', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} start="2026-10-01T15:00" />)
    await userEvent.click(screen.getByRole('button', { name: /Oct 1|1 Oct/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Friday, (2 October|October 2)$/ }))
    await userEvent.selectOptions(screen.getByLabelText('Hour'), '9')
    await userEvent.selectOptions(screen.getByLabelText('Minute'), '30')
    await userEvent.click(screen.getByRole('radio', { name: 'AM' }))
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(onChange).toHaveBeenCalledWith('2026-10-02T09:30')
    expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument()
  })

  it('keeps the old value on Cancel and on Escape', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} start="2026-10-01T15:00" />)
    const field = screen.getByRole('button', { name: /Oct 1|1 Oct/ })
    await userEvent.click(field)
    await userEvent.selectOptions(screen.getByLabelText('Hour'), '9')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(field)
    await userEvent.keyboard('{Escape}')
    expect(onChange).not.toHaveBeenCalled()
    expect(field).toHaveTextContent(/3:00/)
  })

  it('will not take a time that has passed, and can go back to no date', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} start="2026-01-01T09:00" />)
    await userEvent.click(screen.getByRole('button', { name: /Jan 1|1 Jan/ }))
    await userEvent.click(screen.getByRole('radio', { name: 'AM' }))
    await userEvent.selectOptions(screen.getByLabelText('Hour'), '12')
    expect(screen.getByText('That time has already passed. Pick a later one.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(screen.getByRole('button', { name: 'No date' }))
    expect(onChange).toHaveBeenCalledWith('')
  })
})
