/**
 * A game played end to end in a teacher's preview (§23): the cover, the
 * story, a chapter, the challenges in the game's style — answered, hinted,
 * revealed and explained — the chapter's stars and the finale. Marked by the
 * preview's grader, exactly as the server would mark it.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'
import type { BuddyHandle } from '@/features/buddies'
import type { GameStyle, SetDetail } from '@/features/learning/api'
import { PlayBackendProvider } from '@/features/play/backend'
import { PlayLevelProvider } from '@/features/play/level'
import { previewAttempt, PreviewGrader } from '@/features/play/preview'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { GamePlayer } from './GamePlayer'

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))
afterEach(() => vi.unstubAllGlobals())

const challenge = (n: number, difficulty: string) => ({
  id: `g${n}`,
  prompt: `Challenge ${n}: which is right?`,
  options: [`Right ${n}`, `Wrong ${n}`, `Also wrong ${n}`],
  answer: 0,
  explanation: `Because ${n}.`,
  hint: n === 1 ? 'Look for the word Right.' : '',
  skill: 'light',
  difficulty,
  source_ids: [],
})

function gameSet(style: GameStyle): SetDetail {
  return {
    id: 's1', kind: 'game', purpose: 'assign', title: 'Fractions', subject: 'Mathematics', topic: 'fractions',
    grade_level: 'year_2', grade_label: 'Year 2', level: 'beginner', language: 'en', status: 'ready', failure: null,
    item_count: 3, requested_count: 3, version: 1, grounded: true, shares: 0, archived: false,
    updated_at: '2026-10-08T00:00:00Z', sources: [], skills: [{ slug: 'light', label: 'Light' }],
    items: [challenge(1, 'easy'), challenge(2, 'easy'), challenge(3, 'hard')],
    extras: {
      title: 'Rescue at the River', style, world: 'rainforest', authored: false,
      story: {
        hook: 'The river has flooded! {buddy} needs you.', goal: 'Get everyone home.',
        chapters: [
          { title: 'The Bank', intro: 'Start at the bank.', outro: 'Off we go!' },
          { title: 'The Bridge', intro: 'Cross the bridge.', outro: 'Across!' },
          { title: 'Home', intro: 'Nearly there.', outro: 'Home!' },
        ],
        win: 'Hooray, {buddy} is home!', retry: 'Again!',
      },
    },
  } as unknown as SetDetail
}

function mount(style: GameStyle = 'quest') {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
  const set = gameSet(style)
  const grader = new PreviewGrader(set)
  const finished = vi.fn()
  render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <ToastProvider>
            <PlayLevelProvider value="little">
              <PlayBackendProvider value={grader}>
                <GamePlayer attempt={previewAttempt(set)} buddy={createRef<BuddyHandle>()} exitTo="/library/s1" onFinished={finished} />
              </PlayBackendProvider>
            </PlayLevelProvider>
          </ToastProvider>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  return { grader, finished, set }
}

async function answer(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(await screen.findByRole('button', { name: new RegExp(text) }))
}

describe('a game', () => {
  it('tells its story with the buddy in it, then plays chapter by chapter to the finale', async () => {
    const user = userEvent.setup()
    const { finished } = mount()
    await user.click(await screen.findByRole('button', { name: /Start the adventure/ }))
    expect(await screen.findByText(/Kiko needs you/)).toBeInTheDocument()
    expect(screen.getByText('Get everyone home.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Let's go/ }))

    // Chapter 1: one challenge, answered right.
    expect(await screen.findByText('The Bank')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Let's go/ }))
    expect(await screen.findByText(/Challenge 1: which is right/)).toBeInTheDocument()
    await answer(user, 'Option 1: Right 1')
    expect(await screen.findByRole('status', { name: 'How it went' })).toHaveTextContent(/Because 1/)
    await user.click(screen.getByRole('button', { name: /Finish the chapter/ }))
    expect(await screen.findByLabelText('3 of 3 stars')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Next chapter/ }))

    // Chapter 2: answered wrong — the right answer is shown and explained.
    await user.click(await screen.findByRole('button', { name: /Let's go/ }))
    await answer(user, 'Option 2: Wrong 2')
    const reveal = await screen.findByRole('status', { name: 'How it went' })
    expect(within(reveal).getByText('Right 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Finish the chapter/ }))
    expect(await screen.findByLabelText('0 of 3 stars')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Next chapter/ }))

    // The final chapter: the boss.
    await user.click(await screen.findByRole('button', { name: /Face the final challenge/ }))
    expect(await screen.findByText('The boss challenge!')).toBeInTheDocument()
    await answer(user, 'Option 1: Right 3')
    await user.click(await screen.findByRole('button', { name: /Finish the chapter/ }))
    await user.click(await screen.findByRole('button', { name: /To the finale/ }))
    expect(await screen.findByText('Hooray, Kiko is home!')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /See my points/ }))
    expect(finished).toHaveBeenCalledTimes(1)
  })

  it('gives the buddy’s hint only when asked, and it costs points', async () => {
    const user = userEvent.setup()
    const { grader, set } = mount()
    await user.click(await screen.findByRole('button', { name: /Start the adventure/ }))
    await user.click(await screen.findByRole('button', { name: /Let's go/ }))
    await user.click(await screen.findByRole('button', { name: /Let's go/ }))
    expect(screen.queryByText(/Look for the word Right/)).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Ask Kiko for a hint/ }))
    expect(await screen.findByText(/Look for the word Right/)).toBeInTheDocument()
    await answer(user, 'Option 1: Right 1')
    await screen.findByRole('status', { name: 'How it went' })
    // Beginners are untimed: 100 for the easy right answer, less 40 for the hint.
    expect(grader.finish(previewAttempt(set)).attempt.points).toBe(60)
  })

  it.each(['runner', 'catch', 'match'] as const)('plays a challenge in the %s style by its number key', async (style) => {
    const user = userEvent.setup()
    mount(style)
    await user.click(await screen.findByRole('button', { name: /Start the adventure/ }))
    await user.click(await screen.findByRole('button', { name: /Let's go/ }))
    await user.click(await screen.findByRole('button', { name: /Let's go/ }))
    await screen.findByText(/Challenge 1: which is right/)
    await user.keyboard('1')
    expect(await screen.findByRole('status', { name: 'How it went' })).toHaveTextContent(/Because 1/)
  })

  it('says it is a game set in its world, in its style', async () => {
    mount('catch')
    expect(await screen.findByText('Bubble Catch · Rainforest')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Rescue at the River' })).toBeInTheDocument()
  })
})
