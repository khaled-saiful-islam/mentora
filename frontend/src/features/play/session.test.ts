import { describe, expect, it } from 'vitest'
import type { Played } from './api'
import { playedById, resumeAt, segments, starsFor, verdictFor } from './session'

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const played = (id: string, correct: boolean | null): Played => ({ item_id: id, choice: 0, knew: null, correct, reveal: null })

describe('a sitting', () => {
  it('resumes at the first item without an answer', () => {
    expect(resumeAt(items, {})).toBe(0)
    expect(resumeAt(items, playedById([played('a', true)]))).toBe(1)
    expect(resumeAt(items, playedById(items.map((i) => played(i.id, true))))).toBe(3)
  })

  it('colours the progress bar by what is known', () => {
    const answers = playedById([played('a', true), played('b', null)])
    expect(segments(items, answers, 2)).toEqual(['correct', 'answered', 'current'])
    expect(segments(items, playedById([played('a', false)]), 1)).toEqual(['wrong', 'current', 'todo'])
  })

  it.each([
    [100, 3],
    [90, 3],
    [89.9, 2],
    [70, 2],
    [69, 1],
    [40, 1],
    [39, 0],
  ])('%s%% earns %i stars, as the server says', (percent, stars) => {
    expect(starsFor(percent)).toBe(stars)
  })

  it('words the finish kindly at every score', () => {
    expect([3, 2, 1, 0].map(verdictFor)).toEqual(['great', 'good', 'keep', 'keep'])
  })
})
