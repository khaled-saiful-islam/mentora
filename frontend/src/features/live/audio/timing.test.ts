import { describe, expect, it } from 'vitest'
import { LEAD_SECONDS, loudness, nextStart, PAUSE_SECONDS, syllables, wordAt, wordTimings } from './timing'

describe('when the next clip starts', () => {
  it('starts straight away, a moment ahead, when nothing is playing', () => {
    expect(nextStart(10, null)).toBeCloseTo(10 + LEAD_SECONDS)
  })

  it("follows the clip before it after that clip's own pause, with no other gap", () => {
    expect(nextStart(10, { end: 14, pause: 'breath' })).toBeCloseTo(14 + PAUSE_SECONDS.breath)
    expect(nextStart(10, { end: 14, pause: 'think' })).toBeCloseTo(14 + PAUSE_SECONDS.think)
  })

  it('never starts in the past, even when the one before ended long ago', () => {
    expect(nextStart(20, { end: 14, pause: 'short' })).toBeCloseTo(20 + LEAD_SECONDS)
  })
})

describe('when each word is heard', () => {
  it('counts syllables well enough to pace a caption', () => {
    expect(syllables('leaf')).toBe(1)
    expect(syllables('photosynthesis')).toBe(5)
    expect(syllables('chlorophyll,')).toBe(3)
    expect(syllables('make')).toBe(1)
    expect(syllables('2024')).toBe(4)
    expect(syllables('—')).toBe(0)
  })

  it('shares the clip out in order, longer words taking longer, inside the clip', () => {
    const t = wordTimings('Leaves make food, using photosynthesis.', 3)
    expect(t.map((w) => w.word)).toEqual(['Leaves', 'make', 'food,', 'using', 'photosynthesis.'])
    for (let i = 1; i < t.length; i++) expect(t[i].start).toBeGreaterThanOrEqual(t[i - 1].end)
    expect(t[4].end - t[4].start).toBeGreaterThan(t[1].end - t[1].start)
    expect(t[0].start).toBeGreaterThan(0)
    expect(t[4].end).toBeLessThanOrEqual(3)
  })

  it('gives a comma a small breath and a full stop a longer one', () => {
    const t = wordTimings('One, two. Three', 3)
    const afterComma = t[1].start - t[0].end
    const afterStop = t[2].start - t[1].end
    expect(afterComma).toBeGreaterThan(0)
    expect(afterStop).toBeGreaterThan(afterComma)
  })

  it('finds the word being said at a moment', () => {
    const t = wordTimings('one two three', 3)
    expect(wordAt(t, 0)).toBe(-1)
    expect(wordAt(t, t[1].start + 0.01)).toBe(1)
    expect(wordAt(t, 99)).toBe(2)
  })

  it('has nothing to time in an empty clip', () => {
    expect(wordTimings('', 2)).toEqual([])
    expect(wordTimings('hello', 0)).toEqual([])
  })
})

describe('loudness', () => {
  it('is nothing in silence and more for louder speech, within 0…1', () => {
    expect(loudness(new Float32Array(64))).toBe(0)
    const quiet = loudness(new Float32Array(64).fill(0.05))
    const loud = loudness(new Float32Array(64).fill(0.3))
    expect(quiet).toBeGreaterThan(0)
    expect(loud).toBeGreaterThan(quiet)
    expect(loud).toBeLessThanOrEqual(1)
  })
})
