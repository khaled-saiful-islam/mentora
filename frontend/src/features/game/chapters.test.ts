import { describe, expect, it } from 'vitest'
import { chapterSizes, chaptersOf, chapterStars, told } from './chapters'

describe('chapters', () => {
  it('splits challenges as evenly as the server does, extras first', () => {
    expect(chapterSizes(9)).toEqual([3, 3, 3])
    expect(chapterSizes(10)).toEqual([4, 3, 3])
    expect(chapterSizes(11)).toEqual([4, 4, 3])
    expect(chapterSizes(2)).toEqual([1, 1, 0])
  })

  it('groups the challenges under the story’s chapters and drops an empty one', () => {
    const extras = { story: { hook: '', goal: '', win: '', retry: '', chapters: [{ title: 'Bank', intro: 'Go!', outro: 'Done' }, { title: 'Bridge', intro: '', outro: '' }, { title: 'Home', intro: '', outro: '' }] } }
    const chapters = chaptersOf(['a', 'b'], extras)
    expect(chapters.map((c) => [c.title, c.items, c.start])).toEqual([
      ['Bank', ['a'], 0],
      ['Bridge', ['b'], 1],
    ])
  })

  it('names a chapter the story left out', () => {
    expect(chaptersOf(['a', 'b', 'c'], {}).map((c) => c.title)).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3'])
  })

  it('gives stars for how much of a chapter was right', () => {
    expect([chapterStars(3, 3), chapterStars(2, 3), chapterStars(1, 3), chapterStars(0, 3)]).toEqual([3, 2, 1, 0])
    expect(chapterStars(0, 0)).toBe(0)
  })

  it('puts the buddy into the story', () => {
    expect(told('{buddy} waves. Go, {buddy}!', 'Momo')).toBe('Momo waves. Go, Momo!')
    expect(told(undefined, 'Momo')).toBe('')
  })
})
