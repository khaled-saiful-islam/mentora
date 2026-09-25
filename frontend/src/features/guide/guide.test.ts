import { afterEach, describe, expect, it } from 'vitest'
import { isLevel, rememberLevel, rememberedLevel } from './level'
import { layoutMap } from './map'
import { markTerms, minutesToRead, paragraphs, sentenceAt } from './text'

const terms = [
  { term: 'water', meaning: 'Wet stuff.', translation: 'air' },
  { term: 'water cycle', meaning: 'Water going round.', translation: 'kitaran air' },
  { term: 'vapour', meaning: 'Water as a gas.', translation: 'wap' },
]

describe('markTerms', () => {
  it('marks each word to know once, the longest match first', () => {
    const pieces = markTerms('The water cycle moves water. Vapour rises; vapour cools.', terms)
    const marked = pieces.filter((p) => p.term).map((p) => p.text)
    expect(marked).toEqual(['water cycle', 'water', 'Vapour'])
    expect(pieces.map((p) => p.text).join('')).toBe('The water cycle moves water. Vapour rises; vapour cools.')
  })

  it('matches whole words only', () => {
    const pieces = markTerms('Waterfalls are not water.', [terms[0]])
    expect(pieces.filter((p) => p.term).map((p) => p.text)).toEqual(['water'])
  })

  it('remembers words already marked in an earlier paragraph', () => {
    const seen = new Set<string>()
    markTerms('Some vapour.', terms, seen)
    expect(markTerms('More vapour.', terms, seen).some((p) => p.term)).toBe(false)
  })

  it('leaves text with no words to know alone', () => {
    expect(markTerms('Hello.', [])).toEqual([{ text: 'Hello.' }])
    expect(markTerms('', terms)).toEqual([])
  })

  it('does not choke on a word with regex characters', () => {
    const odd = [{ term: 'H2O (water)', meaning: 'Water.', translation: '' }]
    expect(markTerms('We drink H2O (water) daily.', odd).filter((p) => p.term)).toHaveLength(1)
  })
})

describe('sentenceAt', () => {
  const text = 'The Sun shines. Water warms up!\n\nThen it rises.'

  it('finds the sentence being read', () => {
    const [start, end] = sentenceAt(text, 18)
    expect(text.slice(start, end)).toBe('Water warms up!')
  })

  it('handles the first and last sentence and out-of-range positions', () => {
    expect(text.slice(...sentenceAt(text, 0))).toBe('The Sun shines.')
    expect(text.slice(...sentenceAt(text, 999))).toBe('Then it rises.')
  })
})

describe('paragraphs and reading time', () => {
  it('splits on blank lines', () => {
    expect(paragraphs('One.\n\n\nTwo.\n')).toEqual(['One.', 'Two.'])
  })

  it('never says zero minutes', () => {
    expect(minutesToRead(10)).toBe(1)
    expect(minutesToRead(600)).toBe(5)
  })
})

describe('layoutMap', () => {
  const sections = [
    { heading: 'Evaporation', terms: [{ term: 'vapour' }, { term: 'heat' }, { term: 'extra' }] },
    { heading: 'Condensation', terms: [{ term: 'cloud' }] },
    { heading: 'Precipitation', terms: [] },
  ]

  it('puts the topic in the middle, sections round it, and two words each at most', () => {
    const map = layoutMap('The water cycle', sections, 720, 440)
    expect(map.nodes[0]).toMatchObject({ id: 'centre', x: 360, y: 220, ring: 0 })
    expect(map.nodes.filter((n) => n.ring === 1)).toHaveLength(3)
    expect(map.nodes.filter((n) => n.ring === 2)).toHaveLength(3)
    expect(map.edges).toHaveLength(6)
  })

  it('starts the first section at the top and keeps every node on the canvas', () => {
    const map = layoutMap('Topic', sections, 720, 440)
    const first = map.nodes.find((n) => n.id === 's0')
    expect(first?.y).toBeLessThan(220)
    for (const node of map.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0)
      expect(node.x).toBeLessThanOrEqual(720)
      expect(node.y).toBeGreaterThanOrEqual(0)
      expect(node.y).toBeLessThanOrEqual(440)
    }
  })
})

describe('reading level', () => {
  afterEach(() => localStorage.clear())

  it('defaults to just right and remembers a choice', () => {
    expect(rememberedLevel()).toBe('core')
    rememberLevel('stretch')
    expect(rememberedLevel()).toBe('stretch')
  })

  it('ignores something that is not a level', () => {
    localStorage.setItem('mentora-reading-level', 'extreme')
    expect(rememberedLevel()).toBe('core')
    expect(isLevel('simple')).toBe(true)
    expect(isLevel(3)).toBe(false)
  })
})
