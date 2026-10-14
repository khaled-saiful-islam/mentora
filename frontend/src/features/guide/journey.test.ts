import { describe, expect, it } from 'vitest'
import { guideBoss, partRounds, type PartWords } from './journey'

const word = (term: string, meaning: string) => ({ term, meaning, translation: '' })

const PARTS: PartWords[] = [
  { id: 'a', terms: [word('vapour', 'Water as a gas.'), word('evaporate', 'To turn into gas.')] },
  { id: 'b', terms: [word('cloud', 'Tiny drops together.'), word('vapour', 'Water as a gas.')], steps: ['Sun heats the sea.', 'Vapour rises.', 'Clouds form.'] },
  { id: 'c', terms: [word('rain', 'Drops that fall.'), word('puddle', 'Rain on the ground.')] },
]

describe('a guide\'s journey (§28.3.8)', () => {
  it('makes no Match Up from too few words, and tops a part up with words met before', () => {
    expect(partRounds(PARTS, 0, 'en')).toEqual([])
    const [match] = partRounds(PARTS, 2, 'en')
    expect(match.play).toBe('match')
    if (match.play !== 'match') return
    const lefts = match.content.pairs.map((p) => p.left)
    expect(lefts.slice(0, 2)).toEqual(['rain', 'puddle'])
    expect(lefts.length).toBeGreaterThanOrEqual(3)
    expect(new Set(lefts).size).toBe(lefts.length)
    expect(match.content.pairs[0].why).toBe('"rain" means: Drops that fall.')
  })

  it('lines up the steps of a process, saying what each comes after', () => {
    const rounds = partRounds(PARTS, 1, 'en')
    const order = rounds.find((r) => r.play === 'order')
    expect(order?.play).toBe('order')
    if (order?.play !== 'order') return
    expect(order.content.steps.map((s) => s.text)).toEqual(PARTS[1].steps)
    expect(order.content.steps[1].why).toBe('This comes after "Sun heats the sea.".')
    expect(partRounds([{ id: 'x', terms: [], steps: ['One.', 'Two.'] }], 0, 'en')).toEqual([])
  })

  it('makes a boss from every part\'s words, the same each time, in the guide\'s language', () => {
    const boss = guideBoss(PARTS, 'ms')
    expect(boss).not.toBeNull()
    if (!boss) return
    expect(boss.questions.length).toBeGreaterThanOrEqual(4)
    expect(boss.questions[0].ask).toMatch(/^Apakah maksud "/)
    for (const q of boss.questions) {
      expect(new Set(q.options).size).toBe(q.options.length)
      expect(q.options[q.answer]).toBeTruthy()
    }
    expect(guideBoss(PARTS, 'ms')).toEqual(boss)
    expect(guideBoss(PARTS.slice(0, 1), 'en')).toBeNull()
  })
})
