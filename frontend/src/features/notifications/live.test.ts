import { describe, expect, it } from 'vitest'
import { liveOf, LIVE_TOPICS } from './NotificationsProvider'

describe('liveOf', () => {
  it('reads what a push is about', () => {
    expect(liveOf('{"topic":"progress","assignment_id":"a1","answered":3}')).toEqual({
      topic: 'progress',
      assignment_id: 'a1',
      answered: 3,
    })
  })

  it.each(['not json', '{}', '{"topic": 5}', 'null'])('ignores %s', (data) => {
    expect(liveOf(data)).toBeNull()
  })

  it('listens for every page topic the server sends', () => {
    expect(LIVE_TOPICS).toEqual(['classes', 'members', 'assignments', 'progress', 'leaderboard', 'moderation', 'live', 'work'])
  })
})
