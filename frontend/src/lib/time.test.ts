import { describe, expect, it } from 'vitest'
import { timeAgo } from './time'

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
