import { describe, expect, it } from 'vitest'
import { BUDDIES } from './profiles'
import { performanceFor, STREAK_EVERY } from './reactions'
import { greeting, TIPS, tipFor } from './tips'
import { BUDDY_KEYS } from './types'
import { pick, VOICES } from './voices'

describe('every buddy', () => {
  it.each(BUDDY_KEYS)('%s has a profile, a rig and a full voice', (key) => {
    expect(BUDDIES[key].name).toBeTruthy()
    expect(BUDDIES[key].Rig).toBeTypeOf('function')
    const voice = VOICES[key]
    for (const lines of [voice.hello, voice.tap, voice.correct, voice.wrong, voice.streak, voice.knew, voice.notYet, voice.finish.great, voice.finish.good, voice.finish.keep]) {
      expect(lines.length).toBeGreaterThan(0)
    }
    expect(voice.streak.every((line) => line.includes('{n}'))).toBe(true)
  })

  it('never says hello twice in one breath', () => {
    for (const key of BUDDY_KEYS) {
      for (const line of VOICES[key].hello) expect(line).not.toMatch(/^(hi|hello)\b/i)
    }
  })

  it('never promises another try at the end, since retakes may be off', () => {
    for (const key of BUDDY_KEYS) {
      for (const line of VOICES[key].finish.keep) expect(line).not.toMatch(/try (it )?again|another go/i)
    }
  })
})

describe('performanceFor', () => {
  it('cheers a right answer and celebrates every third in a row', () => {
    expect(performanceFor('correct', 'bolt', { streak: 1 }).mood).toBe('cheer')
    const streak = performanceFor('correct', 'bolt', { streak: STREAK_EVERY * 2 })
    expect(streak.mood).toBe('celebrate')
    expect(streak.line).toContain(String(STREAK_EVERY * 2))
    expect(streak.burst?.[0]).toBe('star')
  })

  it('greets by name', () => {
    expect(performanceFor('hello', 'ollie', { name: 'Aina', seed: 0 }).line).toMatch(/^Hi, Aina! /)
  })

  it('consoles a wrong answer rather than scolding', () => {
    expect(performanceFor('wrong', 'rimau').mood).toBe('oops')
  })
})

describe('tips', () => {
  it('only ever talks about how to learn, or about a skill — never a question', () => {
    // tipFor takes no question, so it has nothing it could give away.
    expect(tipFor.length).toBeLessThanOrEqual(3)
    expect(tipFor('quiz', {}, 0)).toBe(TIPS.quiz[0])
  })

  it('nudges towards a skill to practise on the home screen', () => {
    const tips = new Set(Array.from({ length: 40 }, (_, i) => tipFor('home', { practise: ['fractions'] }, i / 40)))
    expect([...tips].some((tip) => tip.includes('fractions'))).toBe(true)
  })

  it.each([
    [7, 'Selamat pagi'],
    [12, 'Selamat tengah hari'],
    [16, 'Selamat petang'],
    [21, 'Selamat malam'],
    [2, 'Selamat malam'],
  ])('at %i o’clock says %s', (hour, words) => {
    expect(greeting(new Date(2026, 8, 25, hour))).toBe(words)
  })

  it('picks the same line for the same seed', () => {
    expect(pick(['a', 'b', 'c'], 0.5)).toBe('b')
    expect(pick(['a', 'b', 'c'], 0.99)).toBe('c')
  })
})
