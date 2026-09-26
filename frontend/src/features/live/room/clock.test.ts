import { describe, expect, it } from 'vitest'
import { offsetFrom, placement } from './clock'

describe("the server's clock", () => {
  it('trusts the quickest round trip, reading the server at its middle', () => {
    const offset = offsetFrom([
      { sent: 1000, received: 1400, server: 5.0 },
      { sent: 2000, received: 2040, server: 6.5 },
    ])
    // Middle of the fast one: 2.02 s browser time; the server said 6.5.
    expect(offset).toBeCloseTo(6.5 - 2.02)
  })

  it('assumes no difference when it has nothing to go on', () => {
    expect(offsetFrom([])).toBe(0)
  })
})

describe('placing a clip on the audio clock', () => {
  it('waits for a clip that has not started yet', () => {
    expect(placement(105, 3, 100, 20)).toEqual({ at: 25, offset: 0 })
  })

  it('starts a latecomer part-way through the sentence being said', () => {
    expect(placement(99, 3, 100, 20)).toEqual({ at: 20, offset: 1 })
  })

  it('skips a sentence in its last moment rather than blurt a word', () => {
    expect(placement(97.1, 3, 100, 20)).toBeNull()
    expect(placement(90, 3, 100, 20)).toBeNull()
  })
})
