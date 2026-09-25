import { describe, expect, it } from 'vitest'
import { leaderboardOf } from './NotificationsProvider'

describe('leaderboardOf', () => {
  it('reads the assignment a push is about', () => {
    expect(leaderboardOf('{"topic":"leaderboard","assignment_id":"abc"}')).toBe('abc')
  })

  it.each(['not json', '{}', '{"assignment_id": 5}', 'null'])('ignores %s', (data) => {
    expect(leaderboardOf(data)).toBeNull()
  })
})
