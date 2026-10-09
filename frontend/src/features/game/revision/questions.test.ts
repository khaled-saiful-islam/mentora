/**
 * A game's revision questions (§26.8): one from every pair — the left side
 * asks, the right side answers, other right sides are the wrong options — and
 * every boss question, each asked once, easiest first.
 */
import { describe, expect, it } from 'vitest'
import { questionsOf } from './questions'

const identity = <T,>(items: readonly T[]) => [...items]

const ISLANDS = [
  {
    id: 'i1',
    difficulty: 'easy',
    match: {
      pairs: [
        { id: 'p1', left: 'Roots', right: 'drink water', why: 'Roots take in water.' },
        { id: 'p2', left: 'Leaves', right: 'catch light', why: 'Leaves catch sunlight.' },
      ],
    },
  },
  {
    id: 'i2',
    difficulty: 'medium',
    match: {
      pairs: [
        { id: 'p1', left: 'Stem', right: 'holds it up', why: 'The stem holds the plant up.' },
        { id: 'p2', left: 'roots', right: 'drink water', why: 'Said already.' },
        { id: 'p3', left: 'Flower', right: 'makes seeds', why: 'Flowers make seeds.' },
      ],
    },
    boss: { name: 'Ulat', icon: '🐛', questions: [{ id: 'q1', ask: 'What do plants make?', options: ['Food', 'Rocks'], answer: 0, why: 'Plants make food.' }] },
  },
]

describe('a game’s revision questions', () => {
  it('asks each pair’s left side, with its right side among other right sides', () => {
    const questions = questionsOf(ISLANDS, identity)
    const roots = questions.find((q) => q.ask === 'Roots')!
    expect(roots.options[roots.answer]).toBe('drink water')
    expect(roots.options).toHaveLength(4)
    expect(new Set(roots.options).size).toBe(4)
    expect(roots.why).toBe('Roots take in water.')
    expect(roots.id).toBe('i1:p1')
  })

  it('asks each thing once, takes the boss’s questions, and goes easiest first', () => {
    const questions = questionsOf(ISLANDS, identity)
    expect(questions.filter((q) => q.ask.toLowerCase() === 'roots')).toHaveLength(1)
    const boss = questions.find((q) => q.ask === 'What do plants make?')!
    expect(boss.level).toBe(3)
    expect(boss.options[boss.answer]).toBe('Food')
    expect(questions.map((q) => q.level)).toEqual([...questions.map((q) => q.level)].sort((a, b) => a - b))
  })

  it('gives fewer wrong options when the game has fewer answers', () => {
    const [only] = questionsOf([{ id: 'x', match: { pairs: [ISLANDS[0].match.pairs[0], ISLANDS[0].match.pairs[1]] } }], identity)
    expect(only.options).toHaveLength(2)
  })
})
