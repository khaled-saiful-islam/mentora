import { describe, expect, it } from 'vitest'
import { countdown, joinOpen, toLocalInput, whenLabel } from './when'

const now = new Date(2026, 8, 26, 9, 0)

describe('when a live lesson is', () => {
  it('says today and tomorrow in words', () => {
    expect(whenLabel(new Date(2026, 8, 26, 14, 30).toISOString(), now)).toMatch(/^Today, /)
    expect(whenLabel(new Date(2026, 8, 27, 10, 0).toISOString(), now)).toMatch(/^Tomorrow, /)
    expect(whenLabel(new Date(2026, 8, 30, 10, 0).toISOString(), now)).not.toMatch(/Today|Tomorrow/)
  })

  it('counts down in the largest sensible unit', () => {
    expect(countdown(new Date(2026, 8, 26, 9, 12).toISOString(), now)).toBe('in 12 minutes')
    expect(countdown(new Date(2026, 8, 26, 12, 0).toISOString(), now)).toBe('in 3 hours')
    expect(countdown(new Date(2026, 8, 28, 9, 0).toISOString(), now)).toBe('in 2 days')
    expect(countdown(new Date(2026, 8, 26, 8, 30).toISOString(), now)).toBe('now')
    expect(countdown(new Date(2026, 8, 25, 8, 0).toISOString(), now)).toBe('')
  })

  it('opens the door ten minutes before, and while the room is open', () => {
    expect(joinOpen(new Date(2026, 8, 26, 9, 9).toISOString(), 'scheduled', now)).toBe(true)
    expect(joinOpen(new Date(2026, 8, 26, 9, 30).toISOString(), 'scheduled', now)).toBe(false)
    expect(joinOpen(null, 'lobby', now)).toBe(true)
    expect(joinOpen(new Date(2026, 8, 26, 9, 5).toISOString(), 'cancelled', now)).toBe(false)
  })

  it('fills a datetime-local input in the local zone', () => {
    expect(toLocalInput(new Date(2026, 0, 5, 7, 3))).toBe('2026-01-05T07:03')
  })
})
