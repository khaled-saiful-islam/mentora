import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import type { BattleView } from './api'
import BattlePlay from './BattlePlay'
import BattleStage from './BattleStage'

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

const TEAMS: BattleView['teams'] = [
  { key: 'harimau', name: 'Team Harimau', icon: '🐯', members: [{ name: 'Aina', buddy: 'momo' }] },
  { key: 'kancil', name: 'Team Kancil', icon: '🦌', members: [] },
]

const BASE: BattleView = {
  id: 'b1', title: 'Plants', mode: 'tug', phase: 'lobby', version: 1, number: 0, total: 6, seconds_left: 0,
  teams: TEAMS, rope: 0, win: 5, hp: 0, max_hp: 0, answered: 0, players: 1, question: null, reveal: null,
  outcome: null, spirit: null,
}
const QUESTION: BattleView = { ...BASE, phase: 'question', version: 2, number: 1, seconds_left: 18, question: { ask: 'What do leaves need?', options: ['Light', 'Sand', 'Snow', 'Smoke'] } }

const posted: { url: string; body?: string }[] = []

function serve(stream: BattleView[], joined: BattleView = { ...BASE, you: { team: 'harimau', choice: null } }) {
  posted.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
      if (init?.method === 'POST') posted.push({ url, body: init.body ? String(init.body) : undefined })
      if (url.endsWith('/join')) return json(joined)
      if (url.endsWith('/answer')) return json({ taken: true })
      if (url.endsWith('/stream')) {
        const encoder = new TextEncoder()
        // Left open, as a live room's stream is.
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            for (const view of stream) controller.enqueue(encoder.encode(`event: room\ndata: ${JSON.stringify(view)}\n\n`))
          },
        })
        return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
      }
      return new Response('{}', { status: 401 })
    }),
  )
}

function mount(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <PreferencesProvider>
          <Routes>
            <Route path="/battle/:id" element={<BattleStage />} />
            <Route path="/battle/:id/play" element={<BattlePlay />} />
          </Routes>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('Class Battle on a student\'s device (§28.3.6)', () => {
  it('joins a team and waits with the buddy', async () => {
    serve([{ ...BASE, you: { team: 'harimau', choice: null } }])
    mount('/battle/b1/play')
    expect(await screen.findByText("You're on Team Harimau! 🐯")).toBeInTheDocument()
    expect(posted.some((p) => p.url.endsWith('/battles/b1/join'))).toBe(true)
  })

  it('answers with the quiz tiles, locks in, and hears how it went', async () => {
    serve([{ ...QUESTION, you: { team: 'harimau', choice: null } }])
    mount('/battle/b1/play')
    await userEvent.click(await screen.findByRole('button', { name: /Light/ }))
    expect(await screen.findByText(/Locked in!/)).toBeInTheDocument()
    expect(posted.find((p) => p.url.endsWith('/answer'))?.body).toBe('{"choice":0}')
  })

  it('says a right answer pulled for the team', async () => {
    serve([{ ...QUESTION, phase: 'reveal', reveal: { answer: 0, why: 'Leaves make food from light.' }, you: { team: 'harimau', choice: 0 } }])
    mount('/battle/b1/play')
    expect(await screen.findByText('Right! Your team pulls!')).toBeInTheDocument()
  })
})

describe('Class Battle on the class screen', () => {
  it('fills the lobby, then shows each question with who has answered', async () => {
    serve([BASE, { ...QUESTION, answered: 1 }])
    mount('/battle/b1')
    expect(await screen.findByRole('heading', { name: 'What do leaves need?' })).toBeInTheDocument()
    expect(screen.getByText('1 of 1 answered')).toBeInTheDocument()
    expect(screen.getByLabelText('18 seconds left')).toBeInTheDocument()
  })

  it('celebrates every team at the end, with the comeback crew, and ranks nobody', async () => {
    serve([{ ...BASE, phase: 'done', outcome: 'draw', spirit: { teams: { harimau: { right: 4, comebacks: 2, improved: 0.5 }, kancil: { right: 3, comebacks: 0, improved: null } }, comeback_crew: ['Aina'] } }])
    mount('/battle/b1')
    expect(await screen.findByText("It's a draw: both teams pulled hard!")).toBeInTheDocument()
    expect(screen.getByText(/Comeback crew:/).parentElement).toHaveTextContent('Aina')
    expect(screen.getByText('Got better as it went: up 50%')).toBeInTheDocument()
  })
})
