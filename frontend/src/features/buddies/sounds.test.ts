import { describe, expect, it } from 'vitest'
import { babblePitches, MOOD_SOUND, syllables, TONES } from './sounds'
import { BUDDY_KEYS } from './types'

describe("a buddy's voice", () => {
  it('babbles about a syllable a word, two to nine', () => {
    expect(syllables('Hi!')).toBe(2)
    expect(syllables('You outsmarted that one!')).toBe(4)
    expect(syllables('one two three four five six seven eight nine ten eleven')).toBe(9)
  })

  it('says the same line the same way every time, in its own pitch', () => {
    for (const key of BUDDY_KEYS) {
      const tone = TONES[key]
      const pitches = babblePitches('Smart move, well done', tone)
      expect(babblePitches('Smart move, well done', tone)).toEqual(pitches)
      for (const p of pitches) {
        expect(p).toBeGreaterThanOrEqual(tone.base * (1 - tone.spread / 2))
        expect(p).toBeLessThanOrEqual(tone.base * (1 + tone.spread / 2))
      }
    }
  })

  it('lifts at the end of a question or an exclamation', () => {
    const tone = TONES.kiko
    const pitches = babblePitches('Ready to go?', tone)
    expect(pitches[pitches.length - 1]).toBe(tone.base * (1 + tone.spread))
  })

  it('sounds happy for a cheer and soft for a miss, and stays quiet while idle', () => {
    expect(MOOD_SOUND.cheer).toBe('yay')
    expect(MOOD_SOUND.oops).toBe('aww')
    expect(MOOD_SOUND.idle).toBeUndefined()
    expect(MOOD_SOUND.sleepy).toBeUndefined()
  })
})
