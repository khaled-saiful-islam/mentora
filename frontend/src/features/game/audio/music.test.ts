import { describe, expect, it } from 'vitest'
import { compose, frequencyOf, seeded, seedOf } from './music'

describe('game music', () => {
  it('grows the same tune from the same seed, and a different one from another', () => {
    const mood = { scale: [0, 2, 4, 7, 9], density: 0.5 }
    expect(compose(mood, 42)).toEqual(compose(mood, 42))
    expect(compose(mood, 42)).not.toEqual(compose(mood, 43))
  })

  it('comes home to the root at the end of each bar and always sounds on the beat', () => {
    const tune = compose({ scale: [0, 2, 4, 7, 9], density: 0 }, seedOf('fractions'))
    expect(tune[12]).toBe(0)
    expect(tune[28]).toBe(0)
    expect(tune.filter((_, i) => i % 4 === 0).every((d) => d !== null)).toBe(true)
    expect(tune.filter((_, i) => i % 4 !== 0).every((d) => d === null)).toBe(true)
  })

  it('climbs the scale an octave at a time', () => {
    const mood = { root: 220, scale: [0, 2, 4, 7, 9] }
    expect(frequencyOf(mood, 0)).toBeCloseTo(220)
    expect(frequencyOf(mood, 5)).toBeCloseTo(440)
  })

  it('draws evenly from its seeded random', () => {
    const random = seeded(1)
    const values = Array.from({ length: 1000 }, random)
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...values)).toBeLessThan(1)
  })
})
