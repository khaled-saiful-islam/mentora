import { describe, expect, it } from 'vitest'
import type { Played } from '@/features/play/api'
import { chaptersOf } from './chapters'
import { advance, chapterScore, startRun, type Layout, type RunEvent, type RunState } from './run'

const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
const layout: Layout = { ids, chapters: chaptersOf(ids, {}) }  // 3, 2, 2

const played = (id: string, correct = true): Played => ({ item_id: id, choice: 0, knew: null, correct, reveal: { answer: 0, explanation: '' } })
const run = (state: RunState, ...events: RunEvent[]) => events.reduce((s, e) => advance(layout, s, e), state)
const answer = (id: string, correct = true): RunEvent => ({ type: 'answered', played: played(id, correct), earned: correct ? 100 : 0, streak: correct ? 1 : 0 })

describe('a game run', () => {
  it('opens on the title, then the first chapter, then its first challenge', () => {
    const start = startRun(layout, [])
    expect(start.phase).toEqual({ name: 'title' })
    expect(run(start, { type: 'begin' }).phase).toEqual({ name: 'chapter', chapter: 0 })
    expect(run(start, { type: 'begin' }, { type: 'go' }).phase).toEqual({ name: 'challenge', index: 0 })
  })

  it('reveals each answer, then moves through the chapter to its end and the next', () => {
    let state = run(startRun(layout, []), { type: 'begin' }, { type: 'go' }, answer('a'))
    expect(state.phase).toEqual({ name: 'reveal', index: 0 })
    expect(state.points).toBe(100)
    state = run(state, { type: 'next' }, answer('b', false), { type: 'next' }, answer('c'), { type: 'next' })
    expect(state.phase).toEqual({ name: 'chapterEnd', chapter: 0 })
    expect(chapterScore(layout, state, 0)).toEqual({ correct: 2, total: 3 })
    expect(run(state, { type: 'onward' }).phase).toEqual({ name: 'chapter', chapter: 1 })
  })

  it('ends with the finale after the last chapter', () => {
    let state = run(startRun(layout, []), { type: 'begin' })
    for (const [chapter, chapterIds] of [['a', 'b', 'c'], ['d', 'e'], ['f', 'g']].entries()) {
      expect(state.phase).toEqual({ name: 'chapter', chapter })
      state = run(state, { type: 'go' })
      for (const id of chapterIds) state = run(state, answer(id), { type: 'next' })
      state = run(state, { type: 'onward' })
    }
    expect(state.phase).toEqual({ name: 'finale' })
  })

  it('resumes after a reload at the first unanswered challenge', () => {
    const midChapter = run(startRun(layout, [played('a'), played('b')]), { type: 'begin' })
    expect(midChapter.phase).toEqual({ name: 'challenge', index: 2 })
    const atChapterStart = run(startRun(layout, ['a', 'b', 'c'].map((id) => played(id))), { type: 'begin' })
    expect(atChapterStart.phase).toEqual({ name: 'chapter', chapter: 1 })
    const allDone = run(startRun(layout, ids.map((id) => played(id))), { type: 'begin' })
    expect(allDone.phase).toEqual({ name: 'finale' })
  })

  it('ignores an answer given twice and events out of turn', () => {
    const state = run(startRun(layout, []), { type: 'begin' }, { type: 'go' }, answer('a'))
    expect(run(state, answer('a')).points).toBe(100)
    expect(run(state, { type: 'go' })).toBe(state)
    expect(run(state, { type: 'onward' })).toBe(state)
  })

  it('remembers each hint once', () => {
    const state = run(startRun(layout, []), { type: 'hinted', itemId: 'a' }, { type: 'hinted', itemId: 'a' })
    expect(state.hinted).toEqual(['a'])
  })
})
