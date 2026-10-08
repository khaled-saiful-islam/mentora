/**
 * The same numbers as the server's tests (`backend/tests/test_game_kind.py`),
 * so the live counter and the finish screen never disagree.
 */
import { describe, expect, it } from 'vitest'
import { earned, pointsFor, type Answered } from './points'

const reached = (over: Partial<Answered> = {}): Answered => ({ correct: true, hinted: false, difficulty: 'easy', tries: 1, ...over })

describe('points', () => {
  it('pays for harder missions and first goes, and costs a hint', () => {
    expect(earned(reached())).toBe(125)
    expect(earned(reached({ difficulty: 'hard', tries: 3 }))).toBe(150)
    expect(earned(reached({ difficulty: 'medium', hinted: true }))).toBe(110)
    expect(earned(reached({ correct: false, hinted: true }))).toBe(0)
  })

  it('adds the missions up', () => {
    expect(pointsFor([reached(), reached({ difficulty: 'medium' }), reached({ correct: false })])).toBe(275)
  })
})
