import { describe, expect, it } from 'vitest'
import { dueLabel, timeAgo } from './time'

const now = new Date('2026-09-25T12:00:00Z')
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString()

describe('timeAgo', () => {
  it.each([
    [10, 'just now'],
    [120, '2m'],
    [3 * 3600, '3h'],
    [2 * 86400, '2d'],
  ])('%is ago reads as %s', (seconds, label) => expect(timeAgo(ago(seconds), now)).toBe(label))

  it('falls back to a date after a week', () => expect(timeAgo(ago(30 * 86400), now)).toMatch(/\d/))
})

describe('dueLabel', () => {
  const at = (hours: number) => new Date(now.getTime() + hours * 3600 * 1000).toISOString()

  it('says late for a date that has passed, and never refuses', () => {
    expect(dueLabel(at(-2), now)).toEqual({ text: 'Late — you can still do it', late: true, soon: false })
  })

  it('counts calendar days, so tomorrow morning is tomorrow', () => {
    const evening = new Date(2026, 8, 25, 21, 0)
    const nextMorning = new Date(2026, 8, 26, 8, 0).toISOString()
    expect(dueLabel(nextMorning, evening).text).toBe('Due tomorrow')
  })

  it('reads a few days out as a count, and further out as a date', () => {
    expect(dueLabel(at(24 * 3 + 1), now).text).toMatch(/^Due in [34] days$/)
    expect(dueLabel(at(24 * 20), now).text).toMatch(/^Due (?!in |today|tomorrow)/)
  })
})
