/**
 * What a game may say to Mentora (§24.4) — and what it may not.
 */
import { describe, expect, it } from 'vitest'
import { readMessage, SAY_LIMIT } from './bridge'

const game = (data: Record<string, unknown>) => ({ source: 'mentora-game', ...data })

describe('a game’s messages', () => {
  it('are read when they come from the runtime in a known shape', () => {
    expect(readMessage(game({ type: 'ready' }))).toEqual({ type: 'ready' })
    expect(readMessage(game({ type: 'done', id: 'm1', tries: 2 }))).toEqual({ type: 'done', id: 'm1', tries: 2 })
    expect(readMessage(game({ type: 'tried', id: 'm1', tries: 3 }))).toEqual({ type: 'tried', id: 'm1', tries: 3 })
    expect(readMessage(game({ type: 'finished' }))).toEqual({ type: 'finished' })
  })

  it('are ignored when they are anything else', () => {
    expect(readMessage({ type: 'done', id: 'm1' })).toBeNull()
    expect(readMessage(game({ type: 'navigate', url: 'https://example.com' }))).toBeNull()
    expect(readMessage(game({ type: 'done', id: '' }))).toBeNull()
    expect(readMessage(game({ type: 'done', id: 'x'.repeat(41) }))).toBeNull()
    expect(readMessage(game({ type: 'say', text: '   ' }))).toBeNull()
    expect(readMessage('done')).toBeNull()
    expect(readMessage(null)).toBeNull()
  })

  it('are kept within bounds: a sane number of goes, a short line for the buddy', () => {
    expect(readMessage(game({ type: 'done', id: 'm1', tries: 9999 }))).toEqual({ type: 'done', id: 'm1', tries: 99 })
    expect(readMessage(game({ type: 'done', id: 'm1', tries: 'many' }))).toEqual({ type: 'done', id: 'm1', tries: 1 })
    const said = readMessage(game({ type: 'say', text: 'a'.repeat(500) }))
    expect(said?.type === 'say' && said.text.length).toBe(SAY_LIMIT)
  })
})
