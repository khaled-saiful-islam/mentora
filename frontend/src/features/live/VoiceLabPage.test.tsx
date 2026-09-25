import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import VoiceLabPage from './VoiceLabPage'

function renderLab() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <PreferencesProvider>
          <VoiceLabPage />
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

const VOICES = {
  voices: ['alloy', 'fable', 'nova'],
  models: ['ilmu-tts-v2.1', 'ilmu-tts-v2'],
  voice: 'fable',
  model: 'ilmu-tts-v2.1',
  speed: 0.85,
  min_speed: 0.6,
  max_speed: 1.3,
}

const LESSON = {
  title: 'Why leaves are green',
  beats: [
    { id: 'b1', say: 'Okay, everyone. Have you ever wondered why leaves are green?', show: null, pause: 'think' },
    { id: 'b2', say: "Here's the thing. That green is a clue.", show: 'Green means chlorophyll', pause: 'breath' },
  ],
  recap: 'So leaves are little kitchens.',
  seconds: 12,
  problems: [],
  lines: { Aina: { call: 'Yes, Aina? Go ahead.', thanks: 'Ooh, good question, Aina.', redirect: 'x' } },
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function stubFetch() {
  const calls: { path: string; body: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : null })
      if (path === '/api/live/voices') return json(VOICES)
      if (path === '/api/live/voice-lab/lesson') return json(LESSON)
      if (path === '/api/config') return json({ grades: [{ code: 'year_5', label: 'Year 5', stage: 'Primary' }] })
      return new Response('{}', { status: 401 })
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('the voice lab', () => {
  it('offers the voices and writes a lesson for the topic and students given', async () => {
    const calls = stubFetch()
    renderLab()
    expect(await screen.findByRole('radio', { name: 'fable' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/about 150 words a minute/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /write the lesson/i }))
    expect(await screen.findByRole('heading', { name: 'Why leaves are green' })).toBeInTheDocument()
    expect(screen.getByText('then a moment to think')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start the lesson/i })).toBeInTheDocument()

    const asked = calls.find((c) => c.path === '/api/live/voice-lab/lesson')
    await waitFor(() => expect(asked?.body).toEqual({ topic: 'photosynthesis', grade_level: 'year_5', students: ['Aina', 'Hafiz', 'Mei'] }))
  })

  it('changing the voice changes what will be asked for', async () => {
    stubFetch()
    renderLab()
    const nova = await screen.findByRole('radio', { name: 'nova' })
    await userEvent.click(nova)
    expect(nova).toHaveAttribute('aria-checked', 'true')
  })
})
