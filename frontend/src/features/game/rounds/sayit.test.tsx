/**
 * Say It (§28.3.5): a line read aloud lights each word heard; a word missed
 * is said again a bit at a time, in the voice; three tries and the round
 * moves on; and with no microphone, words are tapped as they are said.
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SayIt, SayItContext, type SayItHelp } from './SayIt'
import type { SayContent } from './types'

const recorder = vi.hoisted(() => ({ supported: true, clip: null as null | ((wav: Blob) => Promise<void>) }))

vi.mock('@/features/voice/useRecorder', () => ({
  useRecorder: (onClip: (wav: Blob) => Promise<void>) => {
    recorder.clip = onClip
    return { state: recorder.supported ? 'idle' : 'unsupported', level: 0, start: vi.fn(), stop: vi.fn(), toggle: () => onClip(new Blob(['x'])) }
  },
}))

const SAY: SayContent = {
  lines: [
    { id: 'l1', text: 'Petani menanam padi', icon: '🌾', why: 'A farmer plants rice.' },
    { id: 'l2', text: 'Ikan berenang', icon: '🐟', why: 'Fish swim.' },
  ],
}

function mount(heard: string[], help: Partial<SayItHelp> = {}) {
  const said = vi.fn()
  const onMove = vi.fn()
  const onDone = vi.fn()
  const word = vi.fn()
  const hear = vi.fn(async () => heard.shift() ?? '')
  render(
    <SayItContext.Provider value={{ language: 'ms', hear, word, ...help }}>
      <SayIt content={SAY} band="early" calm say={said} sound={vi.fn()} showMe={0} onMove={onMove} onDone={onDone} />
    </SayItContext.Provider>,
  )
  return { said, onMove, onDone, word, hear }
}

afterEach(() => {
  vi.useRealTimers()
  recorder.supported = true
})

describe('Say It', () => {
  it('lights each word heard and moves to the next line', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { onMove, hear } = mount(['petani menanam padi'])
    await userEvent.click(screen.getByRole('button', { name: 'Tap and read it out loud' }))
    expect(hear).toHaveBeenCalledWith(0, expect.any(Blob))
    expect(onMove).toHaveBeenCalledWith({ piece: 'l1', right: true })
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(screen.getByText('berenang')).toBeInTheDocument()
  })

  it('says a missed word again, a bit at a time, in the voice', async () => {
    const { said, word, onMove } = mount(['petani padi'])
    await userEvent.click(screen.getByRole('button', { name: 'Tap and read it out loud' }))
    expect(onMove).toHaveBeenCalledWith({ piece: 'l1', right: false })
    expect(said).toHaveBeenCalledWith('Listen, then try: me-na-nam')
    expect(word).toHaveBeenCalledWith(1, 'menanam')
  })

  it('moves on after three tries, so nobody is stuck', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mount(['', '', ''])
    for (let n = 0; n < 3; n += 1) await userEvent.click(screen.getByRole('button', { name: 'Tap and read it out loud' }))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(screen.getByText('Ikan')).toBeInTheDocument()
  })

  it('without a microphone, words are tapped as they are said', async () => {
    recorder.supported = false
    const { onDone } = mount([])
    vi.useFakeTimers({ shouldAdvanceTime: true })
    for (const w of ['Petani', 'menanam', 'padi']) await userEvent.click(screen.getByRole('button', { name: w }))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    for (const w of ['Ikan', 'berenang']) await userEvent.click(screen.getByRole('button', { name: w }))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(onDone).toHaveBeenCalled()
  })
})
