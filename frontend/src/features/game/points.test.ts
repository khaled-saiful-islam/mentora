/**
 * The same numbers as the server's tests (`backend/tests/test_game_kind.py`),
 * so the live counter and the finish screen never disagree.
 */
import { describe, expect, it } from 'vitest'
import { pointsFor, secondsFor, type Answered } from './points'

const answered = (over: Partial<Answered> = {}): Answered => ({ correct: true, timeMs: 10_000, hinted: false, difficulty: 'easy', ...over })

describe('points', () => {
  it('pays more for a harder right answer and nothing for a wrong one', () => {
    expect(pointsFor([answered()], null)).toBe(100)
    expect(pointsFor([answered({ difficulty: 'medium' })], null)).toBe(125)
    expect(pointsFor([answered({ difficulty: 'hard' })], null)).toBe(150)
    expect(pointsFor([answered({ correct: false })], null)).toBe(0)
  })

  it('builds a combo up to a cap, and a wrong answer breaks it', () => {
    expect(pointsFor(Array.from({ length: 8 }, () => answered()), null)).toBe(800 + 250)
    expect(pointsFor([answered(), answered(), answered({ correct: false }), answered()], null)).toBe(100 + 110 + 0 + 100)
  })

  it('charges a little for a hint', () => {
    expect(pointsFor([answered({ hinted: true })], null)).toBe(60)
  })

  it('pays a speed bonus only when timed, rounding halves up like the server', () => {
    expect(pointsFor([answered({ timeMs: 2_000 })], 20)).toBe(145)
    expect(pointsFor([answered({ timeMs: 2_000 })], 30)).toBe(147)
    expect(pointsFor([answered({ timeMs: 5_000 })], 20)).toBe(138)
    expect(pointsFor([answered({ timeMs: 3_500 })], 20)).toBe(141)
    expect(pointsFor([answered({ timeMs: 3_000 })], 20)).toBe(143)
    expect(pointsFor([answered({ timeMs: 0 })], 15)).toBe(pointsFor([answered({ timeMs: 1_000 })], 15))
  })

  it.each([
    ['year_2', 'intermediate', 30],
    ['year_5', 'advanced', 20],
    ['form_3', null, 15],
    ['year_5', 'beginner', null],
  ] as const)('times %s at %s level for %s seconds', (grade, level, seconds) => {
    expect(secondsFor(grade, level)).toBe(seconds)
  })
})
