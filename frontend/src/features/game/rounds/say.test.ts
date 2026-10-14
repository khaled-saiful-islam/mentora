import { describe, expect, it } from 'vitest'
import { matchWords, sameWord, syllables, wordsOf } from './say'

describe('Say It: hearing a child (§28.3.5)', () => {
  it('counts words as the server does', () => {
    expect(wordsOf('Petani menanam padi, di sawah!')).toEqual(['Petani', 'menanam', 'padi', 'di', 'sawah'])
  })

  it('forgives what an ear and an accent do, not a different word', () => {
    expect(sameWord('rama', 'ramo')).toBe(true)
    expect(sameWord('berenang', 'brenang')).toBe(true)
    expect(sameWord('Ikan', 'ikan')).toBe(true)
    expect(sameWord('di', 'dia')).toBe(true)
    expect(sameWord('padi', 'pada')).toBe(true)
    expect(sameWord('sungai', 'sawah')).toBe(false)
    expect(sameWord('cat', 'hat')).toBe(false)
    expect(sameWord('butterfly', 'button')).toBe(false)
  })

  it('lights each word heard, in order, and a word heard as two', () => {
    expect(matchWords('Petani menanam padi', 'petani menanam padi').every((w) => w.heard)).toBe(true)
    expect(matchWords('rama-rama terbang', 'ramo ramo terbang').map((w) => w.heard)).toEqual([true, true])
    expect(matchWords('The cat sat on the mat', 'the cat on the mat').map((w) => w.heard)).toEqual([true, true, false, true, true, true])
    expect(matchWords('Ikan berenang', '').map((w) => w.heard)).toEqual([false, false])
  })

  it('says a word again a bit at a time', () => {
    expect(syllables('petani', 'ms')).toBe('pe-ta-ni')
    expect(syllables('berenang', 'ms')).toBe('be-re-nang')
    expect(syllables('sungai', 'ms')).toBe('su-ngai')
    expect(syllables('menanam', 'ms')).toBe('me-na-nam')
    expect(syllables('butterfly', 'en')).toBe('but-ter-fly')
    expect(syllables('sunlight', 'en')).toBe('sun-light')
    expect(syllables('cat', 'en')).toBe('cat')
  })
})
