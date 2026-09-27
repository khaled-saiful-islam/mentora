import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SetDetail } from '@/features/learning/api'
import { spokenQuery } from './backend'
import { PreviewGrader } from './preview'
import { AFTER_QUESTION_MS, GAP_MS, gapAfter, usePlayVoice, type Line } from './usePlayVoice'

const config = vi.hoisted(() => ({ languages: ['en'] as string[] }))
const ctx = vi.hoisted(() => ({ played: 0, available: true }))

vi.mock('@/hooks/useConfig', () => ({
  useConfig: () => ({ read_aloud_languages: config.languages }),
}))

vi.mock('@/lib/audio', () => ({
  audioContext: () =>
    ctx.available
      ? {
          destination: {},
          decodeAudioData: async () => ({}),
          createBufferSource: () => {
            const node = {
              buffer: null,
              onended: null as null | (() => void),
              connect: () => undefined,
              start: () => {
                ctx.played += 1
                setTimeout(() => node.onended?.(), 0)
              },
              stop: () => node.onended?.(),
            }
            return node
          },
        }
      : null,
}))

const LINES: Line[] = [
  { spoken: { item: 'q1', part: 'question' }, text: 'What do plants need?' },
  { spoken: { item: 'q1', part: 'option', n: 0 }, text: 'Triangle: Light' },
]

const spoken: string[] = []

beforeEach(() => {
  config.languages = ['en']
  ctx.played = 0
  ctx.available = true
  spoken.length = 0
  class Utterance {
    lang = ''
    rate = 1
    pitch = 1
    onend: (() => void) | null = null
    onerror: (() => void) | null = null
    onboundary: (() => void) | null = null
    constructor(readonly text: string) {}
  }
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
  vi.stubGlobal('speechSynthesis', { cancel: () => undefined, speak: (u: Utterance) => spoken.push(u.text) })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('where the clips come from', () => {
  it("asks for the student's own attempt, or the set being previewed", () => {
    expect(spokenQuery({ item: 'q1', part: 'option', n: 2 })).toBe('item=q1&part=option&n=2')
    expect(spokenQuery({ item: 'c1', part: 'back' })).toBe('item=c1&part=back')
    const grader = new PreviewGrader({ id: 'set-1', items: [] } as unknown as SetDetail)
    expect(grader.speech('preview-set-1', { item: 'q1', part: 'question' })).toBe('/api/learning-sets/set-1/speech?item=q1&part=question')
  })

  it('leaves a longer breath after the question than between answers', () => {
    expect(gapAfter(LINES[0])).toBe(AFTER_QUESTION_MS)
    expect(gapAfter(LINES[1])).toBe(GAP_MS)
    expect(AFTER_QUESTION_MS).toBeGreaterThan(GAP_MS)
  })
})

describe("the tutor's voice", () => {
  it('plays each line in turn, then goes quiet', async () => {
    const fetched: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      fetched.push(url)
      return new Response(new ArrayBuffer(8), { status: 200 })
    })
    const { result } = renderHook(() => usePlayVoice('a1', 'en'))
    expect(result.current.supported).toBe(true)
    act(() => result.current.read('q1', LINES))
    expect(result.current.reading).toBe('q1')
    expect(fetched).toEqual(['/api/me/attempts/a1/speech?item=q1&part=question', '/api/me/attempts/a1/speech?item=q1&part=option&n=0'])
    await waitFor(() => expect(result.current.reading).toBeNull(), { timeout: 3000 })
    expect(ctx.played).toBe(2)
    expect(spoken).toEqual([])
  })

  it('stops when asked, before the next line', async () => {
    vi.stubGlobal('fetch', async () => new Response(new ArrayBuffer(8), { status: 200 }))
    const { result } = renderHook(() => usePlayVoice('a1', 'en'))
    act(() => result.current.read('q1', LINES))
    await waitFor(() => expect(ctx.played).toBe(1))
    act(() => result.current.stop())
    expect(result.current.reading).toBeNull()
    await new Promise((r) => setTimeout(r, AFTER_QUESTION_MS + 100))
    expect(ctx.played).toBe(1)
  })

  it("falls back to the browser's voice for what it could not say", async () => {
    vi.stubGlobal('fetch', async () => new Response('down', { status: 502 }))
    const { result } = renderHook(() => usePlayVoice('a1', 'en'))
    act(() => result.current.read('q1', LINES))
    await waitFor(() => expect(spoken).toEqual(['What do plants need? Triangle: Light.']))
    expect(ctx.played).toBe(0)
  })

  it("uses the browser's voice for a language the tutor does not read", () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { result } = renderHook(() => usePlayVoice('a1', 'ta'))
    act(() => result.current.read('q1', LINES))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(spoken).toEqual(['What do plants need? Triangle: Light.'])
  })
})
