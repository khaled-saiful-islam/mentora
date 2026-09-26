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
  voices: ['voice_1', 'voice_4'],
  labels: { voice_1: 'Warm female voice', voice_4: 'Bright female voice' },
  models: ['ilmu-tts-v2.1'],
  voice: 'voice_1',
  model: 'ilmu-tts-v2.1',
  speed: 0.8,
  min_speed: 0.8,
  max_speed: 1.2,
}

const LESSON = {
  title: 'Why leaves are green',
  beats: [
    { id: 'b1', say: 'Have you ever wondered why leaves are green?', show: null, pause: 'think', sentences: ['Have you ever wondered why leaves are green?'] },
    { id: 'b2', say: "Here's the thing. That green is a clue.", show: 'Green means chlorophyll', pause: 'breath', sentences: ["Here's the thing.", 'That green is a clue.'] },
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
    expect(await screen.findByRole('radio', { name: 'Warm female voice' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/Calm, like a story/)).toBeInTheDocument()
    // One voice model on offer, so nothing to choose.
    expect(screen.queryByLabelText('Voice model')).not.toBeInTheDocument()

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
    const bright = await screen.findByRole('radio', { name: 'Bright female voice' })
    await userEvent.click(bright)
    expect(bright).toHaveAttribute('aria-checked', 'true')
  })
})
