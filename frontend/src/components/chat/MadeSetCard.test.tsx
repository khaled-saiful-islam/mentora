import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHECK_EVERY_MS, MadeSetCard, setIdOf } from './MadeSetCard'

const ID = '11111111-2222-3333-4444-555555555555'
const SOURCE = { rank: 0, title: 'Fractions', url: `/library/${ID}`, snippet: 'Quiz · Year 4 · Mathematics' }

function serve(...replies: Array<Record<string, unknown> | number>) {
  const fetchMock = vi.fn(async () => {
    const next = replies.length > 1 ? replies.shift()! : replies[0]
    if (typeof next === 'number') return new Response('{}', { status: next })
    return new Response(JSON.stringify({ id: ID, kind: 'quiz', title: 'Fractions for Year 4', item_count: 0, ...next }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const mount = () => render(<MemoryRouter><MadeSetCard source={SOURCE} /></MemoryRouter>)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('a set made from the chat', () => {
  it('reads its id from its address', () => {
    expect(setIdOf(`/library/${ID}`)).toBe(ID)
    expect(setIdOf('https://e.test/library/x')).toBeNull()
  })

  it('shows it being made, then ready with Open and Preview', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = serve({ status: 'generating' }, { status: 'ready', item_count: 8 })
    mount()
    expect(await screen.findByText('Making it — about a minute')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS + 50)
    })
    expect(await screen.findByText('Ready — 8 questions')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Preview/ })).toHaveAttribute('href', `/library/${ID}/try`)
    expect(screen.getByRole('link', { name: /Open/ })).toHaveAttribute('href', `/library/${ID}`)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS * 3)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('says so when it could not be made, or is gone', async () => {
    serve({ status: 'failed' })
    const { unmount } = mount()
    expect(await screen.findByText('It could not be made. Open it to try again.')).toBeInTheDocument()
    unmount()
    serve(404)
    mount()
    expect(await screen.findByText('No longer in your Library.')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
