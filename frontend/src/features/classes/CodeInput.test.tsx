import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { CodeInput } from './CodeInput'

function Harness() {
  const [code, setCode] = useState('')
  return (
    <>
      <CodeInput value={code} onChange={setCode} />
      <output>{code}</output>
    </>
  )
}

describe('CodeInput', () => {
  it('fills box by box, upper-cases, and skips letters a code never has', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByLabelText('Letter 1'), 'ab0c')
    expect(document.querySelector('output')?.textContent).toBe('ABC')
  })

  it('takes a pasted code into every box', async () => {
    render(<Harness />)
    screen.getByLabelText('Letter 1').focus()
    await userEvent.paste('k7mq2x')
    expect(document.querySelector('output')?.textContent).toBe('K7MQ2X')
  })

  it('backspace walks back', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByLabelText('Letter 1'), 'abc')
    await userEvent.keyboard('{Backspace}{Backspace}')
    expect(document.querySelector('output')?.textContent).toBe('A')
  })
})
