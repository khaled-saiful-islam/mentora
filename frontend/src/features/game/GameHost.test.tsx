/**
 * A game played in a maker's preview (§26): the story's opening, the treasure
 * map with the islands under fog until their turn, each island's Learn it,
 * its round played move by move — a wrong move answered with why — what each
 * taught with its stars, Show me, the buddy's hint, finishing early, and the
 * finale.
 */
import { render, screen, within } from '@testing-library/react'
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

type User = ReturnType<typeof userEvent.setup>

const BASKETS = [
  { id: 'in', label: 'Takes in', icon: '⬇️' },
  { id: 'out', label: 'Gives out', icon: '⬆️' },
]
const CARDS = [
  { id: 'c1', text: 'Water', icon: '💧', basket: 'in', why: 'Roots drink water.' },
  { id: 'c2', text: 'Sunlight', icon: '☀️', basket: 'in', why: 'Leaves catch light.' },
  { id: 'c3', text: 'Oxygen', icon: '🫧', basket: 'out', why: 'Leaves give out oxygen.' },
]
const STEPS = [
  { id: 's1', text: 'Light reaches the leaf', icon: '☀️', why: 'Light comes first.' },
  { id: 's2', text: 'The leaf makes sugar', icon: '🍬', why: 'Then food is made.' },
  { id: 's3', text: 'The plant grows', icon: '🌱', why: 'Food helps it grow.' },
]
const PAIRS = [
  { id: 'p1', left: 'Roots', right: 'drink water', why: 'Roots take in water.' },
  { id: 'p2', left: 'Leaves', right: 'catch light', why: 'Leaves catch sunlight.' },
  { id: 'p3', left: 'Stem', right: 'holds it up', why: 'The stem holds the plant up.' },
]

const island = (n: number, difficulty: string, round: Record<string, unknown>) => ({
  id: `m${n}`, learn: `Idea ${n}: leaves cook food.`, icon: '☀️', task: `Do task ${n}!`, ...round,
  explanation: `Because ${n}.`, hint: n === 1 ? 'Think about roots.' : '', skill: 'light', difficulty, source_ids: [],
})  // fmt: skip

function gameSet(): SetDetail {
  return {
    id: 's1', kind: 'game', purpose: 'assign', title: 'Plants', subject: 'Science', topic: 'photosynthesis',
    grade_level: 'year_5', grade_label: 'Year 5', level: 'beginner', language: 'en', status: 'ready', failure: null,
    item_count: 3, requested_count: 3, version: 1, grounded: true, shares: 0, archived: false,
    updated_at: '2026-10-08T00:00:00Z', sources: [], skills: [{ slug: 'light', label: 'Light' }],
    items: [
      island(1, 'easy', { play: 'sort', sort: { baskets: BASKETS, cards: CARDS }, match: { pairs: PAIRS } }),
      island(2, 'medium', { play: 'order', order: { steps: STEPS } }),
      island(3, 'hard', { play: 'match', match: { pairs: PAIRS } }),
    ],
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

/** Past the opening, onto the map, into island `n`'s Learn it and its round. */
async function enter(user: User, n: number) {
  const opening = screen.queryByRole('button', { name: /Let's play/ })
  if (opening && screen.queryByRole('dialog', { name: 'The story' })) await user.click(opening)
  await user.click(await screen.findByRole('button', { name: new RegExp(`Island ${n}, play it now`) }))
  await user.click(await screen.findByRole('button', { name: /Let's play/ }))
  return screen.findByRole('region', { name: `Island ${n}` })
}

/** The card Sort It Out is showing now, from its baskets' names. */
function currentCard(round: HTMLElement) {
  const label = within(round).getAllByRole('button', { name: /^Put '/ })[0].getAttribute('aria-label') ?? ''
  const found = CARDS.find((card) => label.startsWith(`Put '${card.text}'`))
  if (!found) throw new Error(`no card for ${JSON.stringify(label)}`)
  return found
}

/** Every card still to sort, each in its right basket. */
async function sortAll(user: User, round: HTMLElement) {
  while (within(round).queryAllByRole('button', { name: /^Put '/ }).length > 0) {
    const card = currentCard(round)
    const basket = BASKETS.find((b) => b.id === card.basket)!
    await user.click(within(round).getByRole('button', { name: `Put '${card.text}' in ${basket.label}` }))
  }
}

async function lineUp(user: User, round: HTMLElement) {
  for (const step of STEPS) await user.click(within(round).getByRole('button', { name: new RegExp(`^Put '${step.text}'`) }))
}

/** Every answer into its slot, as a child taps them. */
async function matchAll(user: User, round: HTMLElement) {
  for (const pair of PAIRS) {
    await user.click(within(round).getByRole('button', { name: pair.right }))
    await user.click(within(round).getByRole('button', { name: `Slot for '${pair.left}'` }))
  }
}

describe('a game', () => {
  it('opens on its story, then the map, with each island under fog until its turn', async () => {
    const user = userEvent.setup()
    mount()
    const story = screen.getByRole('dialog', { name: 'The story' })
    expect(within(story).getByText(/The padi is wilting! Kiko needs you\./)).toBeInTheDocument()
    expect(within(story).getByText('My padi is yellow!')).toBeInTheDocument()
    expect(within(story).getByText('3 islands to explore')).toBeInTheDocument()
    await user.click(within(story).getByRole('button', { name: /Let's play/ }))

    expect(screen.getByRole('button', { name: /Island 1, play it now: Idea 1/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Island 2, under the fog' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Island 1, play it now/ }))
    // Learn it before playing: the beat, the one idea, what to do.
    const learn = await screen.findByRole('dialog', { name: 'Learn it' })
    expect(learn).toHaveTextContent('Island 1 of 3 · Sort It Out')
    expect(learn).toHaveTextContent('The leaves need light.')
    expect(learn).toHaveTextContent('Idea 1: leaves cook food.')
    expect(learn).toHaveTextContent('Do task 1!')
    // The first Sort It Out shows how to play it.
    expect(within(learn).getByRole('region', { name: 'How to play' })).toHaveTextContent('Look at the card.')
    await user.click(within(learn).getByRole('button', { name: /Let's play/ }))
    const round = await screen.findByRole('region', { name: 'Island 1' })
    expect(round).toHaveTextContent('Do task 1!')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // How to play, again, from the bar.
    await user.click(screen.getByRole('button', { name: 'How to play' }))
    expect(within(screen.getByRole('dialog', { name: 'How to play' })).getByText(/Tap the basket/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to the game' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('answers every move — a wrong one with why — and marks each island cleared', async () => {
    const user = userEvent.setup()
    const { finished } = mount()
    const sorting = await enter(user, 1)
    const card = currentCard(sorting)
    const wrong = BASKETS.find((b) => b.id !== card.basket)!
    await user.click(within(sorting).getByRole('button', { name: `Put '${card.text}' in ${wrong.label}` }))
    expect(await screen.findByText(card.why)).toBeInTheDocument()
    await sortAll(user, sorting)

    const discovery = await screen.findByRole('dialog', { name: 'What you discovered' })
    expect(discovery).toHaveTextContent('Island 1 cleared!')
    expect(discovery).toHaveTextContent('Because 1.')
    expect(discovery).toHaveTextContent('Green again!')
    // A slip on the way: two stars, and no first-go bonus.
    expect(within(discovery).getByLabelText('2 of 3 stars')).toBeInTheDocument()
    expect(screen.getByLabelText('100 points')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Back to the map/ }))

    expect(screen.getByRole('button', { name: /Island 1, cleared/ })).toBeDisabled()
    await lineUp(user, await enter(user, 2))
    await user.click(await screen.findByRole('button', { name: /Back to the map/ }))
    await matchAll(user, await enter(user, 3))
    await user.click(await screen.findByRole('button', { name: /To the finish/ }))

    const finale = screen.getByRole('dialog', { name: 'The end of the game' })
    expect(finale).toHaveTextContent('Every island cleared!')
    // 100 (easy, a slip) + 150 (medium, no slip) + 175 (hard, no slip)
    expect(finale).toHaveTextContent('3 of 3 islands · 425 points')
    expect(finale).toHaveTextContent('Thank you, Kiko!')
    expect(within(finale).getByLabelText('8 of 9 stars')).toBeInTheDocument()
    await user.click(within(finale).getByRole('button', { name: /See my points/ }))
    expect(finished).toHaveBeenCalledTimes(1)
  })

  it('gives the buddy’s hint when asked, at a cost', async () => {
    const user = userEvent.setup()
    mount()
    const round = await enter(user, 1)
    await user.click(screen.getByRole('button', { name: /Hint/ }))
    expect(await screen.findByText('Think about roots.')).toBeInTheDocument()
    await sortAll(user, round)
    await screen.findByRole('dialog', { name: 'What you discovered' })
    expect(screen.getByLabelText('85 points')).toBeInTheDocument()
  })

  it('offers Show me once the child is stuck: it plays a move, and the island still counts', async () => {
    const user = userEvent.setup()
    mount()
    const round = await enter(user, 1)
    const card = currentCard(round)
    const wrong = BASKETS.find((b) => b.id !== card.basket)!
    await user.click(within(round).getByRole('button', { name: `Put '${card.text}' in ${wrong.label}` }))
    expect(screen.queryByRole('button', { name: /Show me/ })).not.toBeInTheDocument()
    await user.click(within(round).getByRole('button', { name: `Put '${card.text}' in ${wrong.label}` }))
    await user.click(screen.getByRole('button', { name: /Show me/ }))
    // The buddy puts that card where it belongs; the rest are the child's.
    expect(await within(round).findByText('Card 2 of 3', {}, { timeout: 3000 })).toBeInTheDocument()
    await sortAll(user, round)
    const discovery = await screen.findByRole('dialog', { name: 'What you discovered' })
    expect(within(discovery).getByLabelText('1 of 3 stars')).toBeInTheDocument()
    expect(screen.getByLabelText('50 points')).toBeInTheDocument()
  }, 10_000)

  it('can be finished early, and islands not cleared score nothing', async () => {
    const user = userEvent.setup()
    mount()
    await sortAll(user, await enter(user, 1))
    await user.click(await screen.findByRole('button', { name: /Back to the map/ }))
    await enter(user, 2)
    await user.click(screen.getByRole('button', { name: /^Finish$/ }))
    const [, confirm] = await screen.findAllByRole('button', { name: 'Finish' })
    await user.click(confirm)
    const finale = await screen.findByRole('dialog', { name: 'The end of the game' })
    expect(finale).toHaveTextContent('Well played!')
    expect(finale).toHaveTextContent('1 of 3 islands · 125 points')
  })
})
