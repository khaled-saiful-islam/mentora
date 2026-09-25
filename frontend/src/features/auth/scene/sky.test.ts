import { describe, expect, it } from 'vitest'
import { seeded, starField } from './sky'

describe('starField', () => {
  it('is the same sky every time', () => {
    expect(starField(20)).toEqual(starField(20))
  })

  it('keeps every star in the sky and above the hills', () => {
    for (const star of starField(60, 3, 55)) {
      expect(star.x).toBeGreaterThanOrEqual(0)
      expect(star.x).toBeLessThanOrEqual(100)
      expect(star.y).toBeLessThanOrEqual(55)
      expect(star.period).toBeGreaterThan(2)
    }
  })

  it('gives a different sky for a different seed', () => {
    expect(starField(5, 1)).not.toEqual(starField(5, 2))
  })
})

describe('seeded', () => {
  it('stays between 0 and 1', () => {
    const next = seeded(42)
    for (let i = 0; i < 200; i += 1) {
      const value = next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})
