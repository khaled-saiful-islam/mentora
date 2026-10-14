/**
 * How a game begins (§26.8): each of the five openings tells the same story —
 * the character's lines and the buddy's, the goal, how many islands — in its
 * own scene, named "The story", and every one ends at "Accept the mission"
 * (§28.3.2), which stamps it accepted and then starts the game.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { isStart, Opening, START_LABELS, STARTS, type Start } from '.'

const story = {
  title: 'Save the Padi',
  hook: 'The padi is wilting, and the rain will not come.',
  goal: 'Grow the padi back before the harvest.',
  lines: [
    { who: 'Atuk Hassan', says: 'My padi is turning yellow!' },
    { who: '{buddy}', says: '{buddy} will help you, Atuk!' },
  ],
  cast: { buddyKey: 'kiko', buddyName: 'Kiko', character: 'Atuk Hassan' },
  count: 4,
  world: 'kampung' as const,
}

// The step each opening asks for before the story shows, if any.
const OPENER: Record<Start, RegExp | null> = {
  comic: null,
  call: /^Answer$/,
  letter: /Open the bottle/,
  news: null,
  postcard: /Turn it over/,
}

afterEach(() => vi.unstubAllGlobals())

function show(start: Start, calm = true) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
  const onStart = vi.fn()
  const telling = { reading: false, readable: true, toggle: vi.fn() }
  render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <Opening start={start} {...story} telling={telling} onStart={onStart} calm={calm} />
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  return { onStart, telling }
}

describe('a game’s opening', () => {
  it.each(STARTS)('%s tells the story with the buddy named, and starts the game', async (start) => {
    const user = userEvent.setup()
    const { onStart, telling } = show(start)
    const opener = OPENER[start]
    if (opener) await user.click(screen.getByRole('button', { name: opener }))

    const dialog = await screen.findByRole('dialog', { name: 'The story' })
    expect(await within(dialog).findByText(/My padi is turning yellow!/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Kiko will help you, Atuk!/)).toBeInTheDocument()
    expect(within(dialog).queryByText(/\{buddy\}/)).not.toBeInTheDocument()
    expect(within(dialog).getAllByText(/Grow the padi back before the harvest\./).length).toBeGreaterThan(0)
    expect(within(dialog).getAllByText(/4 islands to explore/).length).toBeGreaterThan(0)

    await user.click(within(dialog).getByRole('button', { name: /Read it to me/ }))
    expect(telling.toggle).toHaveBeenCalledTimes(1)
    await user.click(within(dialog).getByRole('button', { name: 'Accept the mission' }))
    expect(screen.getByRole('status')).toHaveTextContent('Mission accepted!')
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1), { timeout: 2500 })
  })

  it('rings before the call is answered, then the chat comes in line by line', async () => {
    const user = userEvent.setup()
    show('call', false)
    expect(screen.getByText('Atuk Hassan is calling…')).toBeInTheDocument()
    expect(screen.queryByText('My padi is turning yellow!')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Answer' }))
    expect(await screen.findByText('My padi is turning yellow!', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Accept the mission' }, { timeout: 4000 })).toBeInTheDocument()
  })

  it('turns the postcard over by itself after a moment', async () => {
    show('postcard', false)
    expect(screen.getByText(/Greetings from the kampung festival!/)).toBeInTheDocument()
    expect(await screen.findByText(/My padi is turning yellow!/, {}, { timeout: 5000 })).toBeInTheDocument()
  }, 8000)

  it('knows its openings by name, and nothing else', () => {
    expect(STARTS.every(isStart)).toBe(true)
    expect(isStart('cartoon')).toBe(false)
    expect(isStart(undefined)).toBe(false)
    expect(START_LABELS.letter).toBe('A letter in a bottle')
  })
})
