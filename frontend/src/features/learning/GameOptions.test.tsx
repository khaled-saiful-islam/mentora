/**
 * What a maker chooses before a game is built (§23): the story — Mentora's
 * surprise, a draft from AI to edit, or their own — and the style and world,
 * each of which Mentora can decide.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StoryDraftAsk } from './api'
import { FRESH_GAME, gameChoices, GameOptions, type GameSetup } from './GameOptions'
import { stagesFor } from './useGeneration'

afterEach(() => vi.unstubAllGlobals())

const ASK: StoryDraftAsk = { topic: 'The water cycle', grade_level: 'year_3', level: 'beginner', language: 'en', world: 'auto' }

function Harness({ topic = ASK.topic, onSetup }: { topic?: string; onSetup?: (setup: GameSetup) => void }) {
  const [setup, setSetup] = useState(FRESH_GAME)
  useEffect(() => {
    onSetup?.(setup)
  }, [setup, onSetup])
  return <GameOptions setup={setup} onChange={setSetup} ask={{ ...ASK, topic }} />
}

function answering(status: number, body: unknown) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('a game’s options', () => {
  it('sends no story of its own when Mentora is to surprise, and the maker’s story trimmed', () => {
    expect(gameChoices({ ...FRESH_GAME, story: 'left over from a draft' })).toEqual({ style: 'auto', world: 'auto', story: '' })
    expect(gameChoices({ mode: 'own', story: '  Siti swims home.  ', style: 'runner', world: 'reef' })).toEqual({ style: 'runner', world: 'reef', story: 'Siti swims home.' })
  })

  it('drafts a story with AI for the maker to read and edit', async () => {
    const fetch = answering(200, { story: 'Hornbill Hana has lost her nest.' })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('radio', { name: /Draft with AI/ }))
    await user.click(screen.getByRole('button', { name: /Draft a story/ }))

    const box = await screen.findByRole('textbox', { name: /make it yours/ })
    expect(box).toHaveValue('Hornbill Hana has lost her nest.')
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/learning-sets/story-draft')
    expect(JSON.parse(String(init?.body))).toMatchObject({ topic: 'The water cycle', grade_level: 'year_3', level: 'beginner' })

    await user.type(box, ' The end.')
    expect(box).toHaveValue('Hornbill Hana has lost her nest. The end.')
    expect(screen.getByRole('button', { name: /Draft another/ })).toBeInTheDocument()
  })

  it('keeps a style and world picked while the draft was on its way', async () => {
    let arrive: (response: Response) => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => (arrive = resolve))))
    const seen = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSetup={seen} />)
    await user.click(screen.getByRole('radio', { name: /Draft with AI/ }))
    await user.click(screen.getByRole('button', { name: /Draft a story/ }))
    await user.click(screen.getByRole('radio', { name: /Bubble Catch/ }))
    arrive(new Response(JSON.stringify({ story: 'Late, but here.' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    expect(await screen.findByRole('textbox', { name: /make it yours/ })).toHaveValue('Late, but here.')
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ style: 'catch', mode: 'draft', story: 'Late, but here.' }))
  })

  it('waits for a topic before drafting', async () => {
    render(<Harness topic=" " />)
    await userEvent.click(screen.getByRole('radio', { name: /Draft with AI/ }))
    expect(screen.getByRole('button', { name: /Draft a story/ })).toBeDisabled()
    expect(screen.getByText(/Say what it's about first/)).toBeInTheDocument()
  })

  it('says so when a draft cannot be made, and the maker can still write their own', async () => {
    answering(503, { error: { code: 'unavailable', message: 'The story writer is resting. Try again in a moment.' } })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('radio', { name: /Draft with AI/ }))
    await user.click(screen.getByRole('button', { name: /Draft a story/ }))
    expect(await screen.findByText(/story writer is resting/)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Write my own/ }))
    await user.type(screen.getByRole('textbox', { name: 'Your story' }), 'Siti the turtle')
    expect(screen.getByText('15 / 2000')).toBeInTheDocument()
  })

  it('lets Mentora decide the style and the world, or the maker pick them', async () => {
    const seen = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSetup={seen} />)
    const styles = screen.getByRole('radiogroup', { name: 'How it plays' })
    expect(within(styles).getByRole('radio', { name: /Let Mentora decide/ })).toHaveAttribute('aria-checked', 'true')

    await user.click(within(styles).getByRole('radio', { name: /Lane Runner/ }))
    await user.click(within(screen.getByRole('radiogroup', { name: 'Where it happens' })).getByRole('radio', { name: /Coral reef/ }))
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ style: 'runner', world: 'reef' }))
    expect(within(styles).getByRole('radio', { name: /Lane Runner/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('is followed as it is made, through writing the story and building the world', () => {
    expect(stagesFor('game')).toContain('finish')
    expect(stagesFor('quiz')).not.toContain('finish')
  })
})
