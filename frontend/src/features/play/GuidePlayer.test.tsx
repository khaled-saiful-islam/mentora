import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/Toast'
import type { BuddyHandle } from '@/features/buddies'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import type { Attempt, GuidePage } from './api'
import { GuidePlayer } from './GuidePlayer'

function page(n: number): GuidePage {
  return {
    id: `p${n}`,
    heading: `Part ${n}: rain`,
    explain: { simple: `Simple ${n}.`, core: `Water vapour rises in part ${n}.`, stretch: `Stretch ${n}.` },
    points: [`Point ${n}`],
    terms: [{ term: 'vapour', meaning: 'Water as a gas.', translation: 'wap' }],
    hook: `Hook ${n}`,
    fact: `Fact ${n}`,
    example: `Example ${n}`,
    image: null,
    prompt: `Question ${n}?`,
    options: ['Sun', 'Moon', 'Fish', 'Rocks'],
    skill: 'water',
    difficulty: 'easy',
    source_ids: [],
  }
}

const GUIDE: Attempt = {
  id: 'att-g', status: 'in_progress', number: 1, title: 'The water cycle', kind: 'study_guide', purpose: 'assign',
  feedback_mode: 'instant', assignment_id: 'as-1', set_id: 'set-1', items: [page(1), page(2)],
  answered: [], skills: [{ slug: 'water', label: 'Water' }], score: 0, max_score: 2, percent: 0, best_streak: 0,
  can_retake: false, attempts_used: 1, leaderboard: false, due_at: null, language: 'en',
  extras: { big_question: 'Where does rain come from?', intro: 'Follow a raindrop.', summary: ['Water goes round.'], challenge: { title: 'Cloud in a jar', steps: ['Fill a jar.'] } },
}

let sent: { item_id: string; choice: number }[] = []

beforeEach(() => {
  sent = []
  localStorage.clear()
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/answers')) {
        const body = JSON.parse(String(init?.body)) as { item_id: string; choice: number }
        sent.push(body)
        const correct = body.choice === 0
        return new Response(JSON.stringify({
          played: { item_id: body.item_id, choice: body.choice, knew: null, correct, reveal: { answer: 0, explanation: 'The Sun heats the water.' } },
          streak: correct ? 1 : 0, answered: sent.length, total: 2,
        }))
      }
      return new Response('{}', { status: 401 })
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

function mount(attempt: Attempt = GUIDE, onFinished = vi.fn()) {
  render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <ToastProvider>
            <GuidePlayer attempt={attempt} buddy={createRef<BuddyHandle>()} exitTo="/" onFinished={onFinished} />
          </ToastProvider>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  return onFinished
}

describe('GuidePlayer', () => {
  it('opens on the big question and the parts to come', () => {
    mount()
    expect(screen.getByRole('heading', { name: 'Where does rain come from?' })).toBeInTheDocument()
    expect(screen.getByText('Follow a raindrop.')).toBeInTheDocument()
    expect(screen.getAllByText('Part 1: rain').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Start reading/ })).toBeInTheDocument()
  })

  it('teaches a part at the level chosen, and remembers the choice', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: /Start reading/ }))
    expect(await screen.findByRole('heading', { name: 'Part 1: rain' })).toBeInTheDocument()
    expect(screen.getByText(/rises in part 1/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /Simpler/ }))
    expect(await screen.findByText('Simple 1.')).toBeInTheDocument()
    expect(localStorage.getItem('mentora-reading-level')).toBe('simple')
  })

  it('opens a word to know with its meaning and its Malay', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: /Start reading/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'vapour' }))
    expect(screen.getByText('Water as a gas.')).toBeInTheDocument()
    expect(screen.getByText('wap')).toBeInTheDocument()
  })

  it('checks each part, explains, and moves on', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: /Start reading/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Moon/ }))
    expect(await screen.findByText(/Not quite/)).toBeInTheDocument()
    expect(screen.getByText('The Sun heats the water.')).toBeInTheDocument()
    expect(sent).toEqual([{ item_id: 'p1', choice: 1, time_ms: expect.any(Number) }])
    await userEvent.click(screen.getByRole('button', { name: /On to part 2/ }))
    expect(await screen.findByRole('heading', { name: 'Part 2: rain' })).toBeInTheDocument()
  })

  it('ends with the big ideas and finishes once every check is done', async () => {
    const onFinished = mount({ ...GUIDE, items: [page(1)] })
    await userEvent.click(screen.getByRole('button', { name: /Start reading/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Sun/ }))
    await userEvent.click(await screen.findByRole('button', { name: /See the big ideas/ }))
    expect(await screen.findByText('Water goes round.')).toBeInTheDocument()
    expect(screen.getByText('Cloud in a jar')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Finish the guide/ }))
    await waitFor(() => expect(onFinished).toHaveBeenCalled())
  })

  it('carries on where a reader left off', () => {
    mount({ ...GUIDE, answered: [{ item_id: 'p1', choice: 0, knew: null, correct: true, reveal: null }] })
    expect(screen.getByRole('button', { name: /Carry on from part 2/ })).toBeInTheDocument()
  })
})
