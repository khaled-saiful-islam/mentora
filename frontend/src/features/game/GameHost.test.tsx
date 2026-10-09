/**
 * A game played in a maker's preview (§24): the story's opening, the game in
 * its sandboxed frame, missions reported by the game and marked on the page,
 * what each taught, the buddy's hint, finishing early, and the finale.
 */
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'
import type { BuddyHandle } from '@/features/buddies'
import type { SetDetail } from '@/features/learning/api'
import { PlayBackendProvider } from '@/features/play/backend'
import { PlayLevelProvider } from '@/features/play/level'
import { previewAttempt, PreviewGrader } from '@/features/play/preview'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { GameHost } from './GameHost'

afterEach(() => vi.unstubAllGlobals())

const mission = (n: number, difficulty: string) => ({
  id: `m${n}`, learn: `Idea ${n}: leaves cook food.`, icon: '☀️', control: 'the sun', guide: `Slide control ${n} up!`,
  goal: `Reach goal ${n}.`, win: `Level ${n}.`, explanation: `Because ${n}.`,
  hint: n === 1 ? 'More sunlight.' : '', skill: 'light', difficulty, source_ids: [],
})  // fmt: skip

function gameSet(): SetDetail {
  return {
    id: 's1', kind: 'game', purpose: 'assign', title: 'Plants', subject: 'Science', topic: 'photosynthesis',
    grade_level: 'year_5', grade_label: 'Year 5', level: 'beginner', language: 'en', status: 'ready', failure: null,
    item_count: 3, requested_count: 3, version: 1, grounded: true, shares: 0, archived: false,
    updated_at: '2026-10-08T00:00:00Z', sources: [], skills: [{ slug: 'light', label: 'Light' }],
    items: [mission(1, 'easy'), mission(2, 'medium'), mission(3, 'hard')],
    extras: {
      title: 'Save the Padi', world: 'rainforest', authored: false,
      character: { name: 'Atuk Hassan', about: 'a padi farmer' },
      story: {
        hook: 'The padi is wilting! {buddy} needs you.', goal: 'Grow it back.', win: 'Hooray, {buddy}!',
        opening: [{ who: 'Atuk Hassan', says: 'My padi is yellow!' }, { who: '{buddy}', says: 'We will help!' }],
        ending: [{ who: 'Atuk Hassan', says: 'Thank you, {buddy}!' }],
      },
      beats: { m1: { before: [{ who: 'Atuk Hassan', says: 'The leaves need light.' }], after: [{ who: '{buddy}', says: 'Green again!' }] } },
    },
  } as unknown as SetDetail
}

function mount() {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
  const set = gameSet()
  const finished = vi.fn()
  render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <ToastProvider>
            <PlayLevelProvider value="middle">
              <PlayBackendProvider value={new PreviewGrader(set)}>
                <GameHost attempt={previewAttempt(set)} buddy={createRef<BuddyHandle>()} exitTo="/library/s1" onFinished={finished} />
              </PlayBackendProvider>
            </PlayLevelProvider>
          </ToastProvider>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  return { finished }
}

/** Past the opening and mission 1's Learn it, into the game. */
async function start(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Let's play/ }))
  await user.click(await screen.findByRole('button', { name: /Let's try/ }))
}

function frame(): HTMLIFrameElement {
  return screen.getByTitle(/The game/) as HTMLIFrameElement
}

/** A message from the game in its frame — or from somewhere pretending. */
function say(data: Record<string, unknown>, from: Window | null = frame().contentWindow) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { source: 'mentora-game', ...data }, source: from }))
  })
}

describe('a game', () => {
  it('opens on its story, then plays its code in a sandboxed frame from its own address', async () => {
    const user = userEvent.setup()
    mount()
    const story = screen.getByRole('dialog', { name: 'The story' })
    expect(within(story).getByText(/The padi is wilting! Kiko needs you\./)).toBeInTheDocument()
    expect(within(story).getByText('My padi is yellow!')).toBeInTheDocument()
    expect(within(story).getByText('Atuk Hassan')).toBeInTheDocument()
    expect(within(story).getByText('3 missions')).toBeInTheDocument()
    expect(frame().getAttribute('src')).toBe('/api/learning-sets/s1/game/play')
    expect(frame().getAttribute('sandbox')).toBe('allow-scripts')
    expect(screen.getByText(/Getting the game ready/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Let's play/ }))
    // Learn it before playing: the beat, the one idea, what to try.
    const learn = await screen.findByRole('dialog', { name: 'Learn it' })
    expect(learn).toHaveTextContent('Mission 1 of 3')
    expect(learn).toHaveTextContent('The leaves need light.')
    expect(learn).toHaveTextContent('Idea 1: leaves cook food.')
    expect(learn).toHaveTextContent('Try it: Slide control 1 up!')
    await user.click(within(learn).getByRole('button', { name: /Let's try/ }))
    say({ type: 'ready' })
    expect(screen.queryByText(/Getting the game ready/)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('marks each mission the game reports, says what it taught, and counts the points', async () => {
    const user = userEvent.setup()
    const { finished } = mount()
    await start(user)
    say({ type: 'ready' })

    say({ type: 'done', id: 'm1', tries: 1 })
    const discovery = await screen.findByRole('dialog', { name: 'What you discovered' })
    expect(discovery).toHaveTextContent('Mission 1 done!')
    expect(discovery).toHaveTextContent('Because 1.')
    expect(discovery).toHaveTextContent('Green again!')
    expect(within(discovery).getByLabelText('3 of 3 stars')).toBeInTheDocument()
    expect(screen.getByLabelText('125 points')).toBeInTheDocument()
    expect(screen.getByLabelText(/Mission 1, reached/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Next mission/ }))

    // Each mission's Learn it comes before it is played.
    await user.click(await screen.findByRole('button', { name: /Let's try/ }))
    say({ type: 'done', id: 'm2', tries: 3 })
    expect(within(await screen.findByRole('dialog', { name: 'What you discovered' })).getByLabelText('2 of 3 stars')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Next mission/ }))
    await user.click(await screen.findByRole('button', { name: /Let's try/ }))
    say({ type: 'done', id: 'm3', tries: 1 })
    await user.click(await screen.findByRole('button', { name: /To the finish/ }))

    const finale = screen.getByRole('dialog', { name: 'The end of the game' })
    expect(finale).toHaveTextContent('Every mission done!')
    // 125 (easy, first go) + 125 (medium, third go) + 175 (hard, first go)
    expect(finale).toHaveTextContent('3 of 3 missions · 425 points')
    expect(finale).toHaveTextContent('Thank you, Kiko!')
    expect(within(finale).getByLabelText('8 of 9 stars')).toBeInTheDocument()
    await user.click(within(finale).getByRole('button', { name: /See my points/ }))
    expect(finished).toHaveBeenCalledTimes(1)
  })

  it('hears only its own frame, only known missions, and each mission once', async () => {
    const user = userEvent.setup()
    mount()
    await start(user)
    say({ type: 'done', id: 'm1', tries: 1 }, window)
    say({ type: 'done', id: 'nope', tries: 1 })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    say({ type: 'done', id: 'm1', tries: 1 })
    await user.click(await screen.findByRole('button', { name: /Next mission/ }))
    await user.click(await screen.findByRole('button', { name: /Let's try/ }))
    say({ type: 'done', id: 'm1', tries: 1 })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('125 points')).toBeInTheDocument()
  })

  it('gives the buddy’s hint when asked, at a cost, and lets the game speak through the buddy', async () => {
    const user = userEvent.setup()
    mount()
    await start(user)
    await user.click(screen.getByRole('button', { name: /Hint/ }))
    expect(await screen.findByText('More sunlight.')).toBeInTheDocument()
    say({ type: 'say', text: 'Try the water too!' })
    say({ type: 'done', id: 'm1', tries: 1 })
    await screen.findByRole('dialog', { name: 'What you discovered' })
    expect(screen.getByLabelText('85 points')).toBeInTheDocument()
  })

  it('offers Show me after two misses: the game plays it, and the mission still counts', async () => {
    const user = userEvent.setup()
    mount()
    await start(user)
    say({ type: 'tried', id: 'm1', tries: 1 })
    expect(screen.queryByRole('button', { name: /Show me/ })).not.toBeInTheDocument()
    say({ type: 'tried', id: 'm1', tries: 2 })
    const posted = vi.spyOn(frame().contentWindow!, 'postMessage')
    await user.click(screen.getByRole('button', { name: /Show me/ }))
    expect(posted).toHaveBeenCalledWith({ source: 'mentora-host', type: 'show', id: 'm1' }, '*')
    expect(screen.queryByRole('button', { name: /Show me/ })).not.toBeInTheDocument()
    say({ type: 'done', id: 'm1', tries: 3 })
    const discovery = await screen.findByRole('dialog', { name: 'What you discovered' })
    expect(within(discovery).getByLabelText('1 of 3 stars')).toBeInTheDocument()
    expect(screen.getByLabelText('50 points')).toBeInTheDocument()
  })

  it('can be finished early, and missions not reached score nothing', async () => {
    const user = userEvent.setup()
    mount()
    await start(user)
    say({ type: 'done', id: 'm1', tries: 1 })
    await user.click(await screen.findByRole('button', { name: /Next mission/ }))
    await user.click(await screen.findByRole('button', { name: /Let's try/ }))
    await user.click(screen.getByRole('button', { name: /^Finish$/ }))
    const [, confirm] = await screen.findAllByRole('button', { name: 'Finish' })
    await user.click(confirm)
    const finale = await screen.findByRole('dialog', { name: 'The end of the game' })
    expect(finale).toHaveTextContent('Well played!')
    expect(finale).toHaveTextContent('1 of 3 missions · 125 points')
  })
})
