import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BuddyHandle } from '@/features/buddies'
import { MILESTONE_DELAY_MS, milestone, NUDGE_AFTER_MS, STRATEGIES, useAnswerCoach, useCoach } from './coach'

afterEach(() => vi.useRealTimers())

function fakeBuddy() {
  const cue = vi.fn()
  const handle = { play: vi.fn(), say: vi.fn(), burst: vi.fn(), trick: vi.fn(), cue } as unknown as BuddyHandle
  return { ref: { current: handle }, cue }
}

describe('milestones', () => {
  it.each([
    [3, 6, 'halfway'],
    [5, 6, 'last'],
    [2, 3, 'last'],
    [1, 2, null],
    [1, 4, null],
    [0, 10, null],
  ])('item %i of %i: %s', (index, total, expected) => {
    expect(milestone(index, total)).toBe(expected)
  })
})

describe('coaching while playing', () => {
  it('says halfway a moment after that item appears', () => {
    vi.useFakeTimers()
    const { ref, cue } = fakeBuddy()
    renderHook(() => useCoach(ref, { index: 3, total: 6, waiting: true }))
    act(() => void vi.advanceTimersByTime(MILESTONE_DELAY_MS))
    expect(cue).toHaveBeenCalledWith('halfway')
  })

  it('nudges a child still on the same item, and not one who has answered', () => {
    vi.useFakeTimers()
    const { ref, cue } = fakeBuddy()
    const { rerender } = renderHook((props: { waiting: boolean }) => useCoach(ref, { index: 1, total: 4, waiting: props.waiting, readAloud: true }), { initialProps: { waiting: true } })
    act(() => void vi.advanceTimersByTime(NUDGE_AFTER_MS - 100))
    rerender({ waiting: false })
    act(() => void vi.advanceTimersByTime(NUDGE_AFTER_MS))
    expect(cue).not.toHaveBeenCalled()
    rerender({ waiting: true })
    act(() => void vi.advanceTimersByTime(NUDGE_AFTER_MS))
    expect(cue).toHaveBeenCalledWith('nudge', { readAloud: true })
  })
})

describe('coaching an answer', () => {
  it('cheers a comeback after a miss, and a strategy after two misses in a row', () => {
    const { result } = renderHook(() => useAnswerCoach())
    const reply = result.current
    expect(reply(true, 1)).toEqual({ cue: 'correct' })
    expect(reply(false, 0)).toEqual({ cue: 'wrong' })
    const tough = reply(false, 0)
    expect(tough.cue).toBe('tough')
    expect(STRATEGIES).toContain(tough.strategy)
    expect(reply(false, 0)).toEqual({ cue: 'wrong' })
    expect(reply(true, 1)).toEqual({ cue: 'comeback' })
    expect(reply(true, 2)).toEqual({ cue: 'correct' })
  })
})
