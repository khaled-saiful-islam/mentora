import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { CHECK_EVERY_MS, MadeSetCard, setIdOf } from './MadeSetCard'

const ID = '11111111-2222-3333-4444-555555555555'
const SOURCE = { rank: 0, title: 'Fractions', url: `/library/${ID}`, snippet: 'Quiz · Year 4 · Mathematics' }

function serve(...replies: Array<Record<string, unknown> | number>) {
  const sets = vi.fn(async () => {
    const next = replies.length > 1 ? replies.shift()! : replies[0]
    if (typeof next === 'number') return new Response('{}', { status: next })
    return new Response(JSON.stringify({ id: ID, kind: 'quiz', title: 'Fractions for Year 4', item_count: 0, ...next }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).includes('/auth/') ? new Response('{}', { status: 401 }) : sets())))
  return sets
}

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/chat']}>
      <AuthProvider>
        <Routes>
          <Route path="/chat" element={<MadeSetCard source={SOURCE} />} />
          <Route path="/library/:id" element={<p>The editor</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('a set made from the chat', () => {
  it('reads its id from its address', () => {
    expect(setIdOf(`/library/${ID}`)).toBe(ID)
    expect(setIdOf('https://e.test/library/x')).toBeNull()
  })

  it('shows it being made, then ready, and Open goes to it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const sets = serve({ status: 'generating' }, { status: 'ready', item_count: 8 })
    mount()
    expect(await screen.findByText('Making it — about a minute')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Watch it being made/ })).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS + 50)
    })
    expect(await screen.findByText('Ready — 8 questions')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Preview/ })).toHaveAttribute('href', `/library/${ID}/try`)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS * 3)
    })
    expect(sets).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
    await userEvent.click(screen.getByRole('button', { name: /^Open/ }))
    expect(await screen.findByText('The editor')).toBeInTheDocument()
  })

  it('says so when it could not be made, or is gone', async () => {
    serve({ status: 'failed' })
    const { unmount } = mount()
    expect(await screen.findByText('It could not be made. Open it to try again.')).toBeInTheDocument()
    unmount()
    serve(404)
    mount()
    expect(await screen.findByText('No longer in your Library.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open/ })).toBeNull()
  })
})
