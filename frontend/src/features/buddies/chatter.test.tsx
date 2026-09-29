import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BuddyHandle } from './Buddy'
import { chatterFor, EVERY_MS, FIRST_AFTER_MS, useBuddyChatter, type ChatterContext } from './chatter'
import { BUDDIES } from './profiles'
import { BUDDY_KEYS } from './types'
import { VOICES } from './voices'

const DAY: ChatterContext = { todo: ['The Water Cycle'], streak: 3, badges: 2, practise: ['fractions'], strengths: ['plants'], madeForYou: 1 }
const QUIET: ChatterContext = { todo: [], streak: 0, badges: 0, practise: [], strengths: [], madeForYou: 0 }

afterEach(() => vi.useRealTimers())

describe('what a buddy says on the home page', () => {
  it('starts with what is waiting, then a fact, a cheer and a tip — in its own voice', () => {
    expect(chatterFor('rimau', DAY, 0, 0).line).toBe(`You've got "The Water Cycle" waiting. Shall we start it together?`)
    expect(chatterFor('rimau', DAY, 0, 0).mood).toBe('point')
    expect(VOICES.rimau.facts).toContain(chatterFor('rimau', DAY, 1, 0).line)
    expect(VOICES.rimau.cheers).toContain(chatterFor('rimau', DAY, 2, 0).line)
    expect(chatterFor('rimau', DAY, 3, 0).mood).toBe('nod')
  })

  it("works through the student's day: practice made for them, the streak, the badges", () => {
    const said = [0, 4, 8, 12, 16].map((turn) => chatterFor('kiko', DAY, turn, 0).line)
    expect(said.some((line) => line.includes('Made for you'))).toBe(true)
    expect(said.some((line) => line.includes('3 days in a row'))).toBe(true)
    expect(said.some((line) => line.includes('2 badges'))).toBe(true)
  })

  it('cheers instead when there is nothing on their day to mention', () => {
    expect(VOICES.ollie.cheers).toContain(chatterFor('ollie', QUIET, 0, 0).line)
  })

  it('moves in its own way as it talks', () => {
    for (const key of BUDDY_KEYS) {
      expect(BUDDIES[key].antics).toContain(chatterFor(key, DAY, 2, 0).mood)
    }
  })

  it('every buddy has facts and cheers of its own', () => {
    for (const key of BUDDY_KEYS) {
      expect(VOICES[key].facts.length).toBeGreaterThanOrEqual(4)
      expect(VOICES[key].cheers.length).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('chatting now and then', () => {
  function fakeBuddy() {
    const say = vi.fn()
    const play = vi.fn()
    return { ref: { current: { say, play, burst: vi.fn(), trick: vi.fn(), cue: vi.fn() } as unknown as BuddyHandle }, say, play }
  }

  it('waits, then says a line every so often, and stops after a handful', () => {
    vi.useFakeTimers()
    const { ref, say } = fakeBuddy()
    renderHook(() => useBuddyChatter(ref, 'momo', DAY, { most: 3 }))
    act(() => void vi.advanceTimersByTime(FIRST_AFTER_MS - 10))
    expect(say).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(20))
    expect(say).toHaveBeenCalledTimes(1)
    act(() => void vi.advanceTimersByTime(EVERY_MS * 5))
    expect(say).toHaveBeenCalledTimes(3)
  })

  it('says nothing while the tab is hidden', () => {
    vi.useFakeTimers()
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const { ref, say } = fakeBuddy()
    renderHook(() => useBuddyChatter(ref, 'momo', DAY))
    act(() => void vi.advanceTimersByTime(FIRST_AFTER_MS + EVERY_MS * 2))
    expect(say).not.toHaveBeenCalled()
    hidden.mockRestore()
  })

  it('waits for the day to arrive before it starts', () => {
    vi.useFakeTimers()
    const { ref, say } = fakeBuddy()
    renderHook(() => useBuddyChatter(ref, 'momo', null))
    act(() => void vi.advanceTimersByTime(FIRST_AFTER_MS * 3))
    expect(say).not.toHaveBeenCalled()
  })
})
