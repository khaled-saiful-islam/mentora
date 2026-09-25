import { describe, expect, it } from 'vitest'
import { reduce, type Generation } from './useGeneration'

const START: Generation = { stages: {}, sources: [], skills: [], items: [], outcome: { kind: 'running' } }

function play(events: [string, Record<string, unknown>][]): Generation {
  return events.reduce((state, [type, data]) => reduce(state, { type, data }), START)
}

describe('the generation reducer', () => {
  it('builds the whole picture from the replayed events', () => {
    const state = play([
      ['stage', { key: 'check', state: 'running', label: 'Checking', detail: '' }],
      ['stage', { key: 'check', state: 'done', label: 'Checking', detail: 'Photosynthesis' }],
      ['sources', { sources: [{ id: 's1', title: 'BBC', host: 'bbc.co.uk', url: 'https://bbc.co.uk' }] }],
      ['skills', { skills: [{ slug: 'light', label: 'Light' }] }],
      ['items', { items: [{ id: 'a' }, { id: 'b' }] }],
      ['items', { items: [{ id: 'c' }] }],
      ['done', { title: 'Plants', count: 3, requested: 5, grounded: true }],
    ])
    expect(state.stages.check?.state).toBe('done')
    expect(state.sources).toHaveLength(1)
    expect(state.skills[0].label).toBe('Light')
    expect(state.items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(state.outcome).toEqual({ kind: 'done', title: 'Plants', count: 3, requested: 5, grounded: true })
  })

  it('ends on a refusal with its words', () => {
    const state = play([['refused', { message: "Let's pick a school topic!" }]])
    expect(state.outcome).toEqual({ kind: 'refused', message: "Let's pick a school topic!" })
  })

  it('ignores events it does not know', () => {
    expect(play([['from_the_future', {}]])).toEqual(START)
  })

  it('resets for a new set', () => {
    const state = play([['items', { items: [{ id: 'a' }] }]])
    expect(reduce(state, { type: 'reset' })).toEqual(START)
  })
})
