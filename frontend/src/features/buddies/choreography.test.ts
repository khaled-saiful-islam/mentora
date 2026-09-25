import { describe, expect, it } from 'vitest'
import { choreograph, HOLD_MS, JOINTS, mirrored, MOVES, REST } from './choreography'
import type { Mood } from './types'

const MOODS = Object.keys(MOVES) as Mood[]
const last = (value: unknown) => (Array.isArray(value) ? value[value.length - 1] : value)

describe('choreograph', () => {
  it.each(MOODS)('gives %s a move for every joint', (mood) => {
    const moves = choreograph(mood)
    expect(Object.keys(moves).sort()).toEqual([...JOINTS].sort())
  })

  it('holds every joint at rest under calm motion, whatever the mood', () => {
    for (const mood of MOODS) {
      for (const move of Object.values(choreograph(mood, {}, true))) {
        expect(move).toMatchObject(REST)
      }
    }
  })

  it('puts a joint the mood does not mention back to rest', () => {
    // Waving uses the right arm only: the left comes home.
    expect(choreograph('wave').armL).toMatchObject({ rotate: 0 })
  })

  it('ends every momentary mood where it started, so it can settle', () => {
    const momentary = MOODS.filter((m) => HOLD_MS[m] > 0 && !['think', 'dance', 'celebrate', 'sleepy', 'listen', 'oops'].includes(m))
    for (const mood of momentary) {
      for (const [joint, move] of Object.entries(MOVES[mood])) {
        for (const [key, value] of Object.entries(move ?? {})) {
          if (key === 'transition' || !Array.isArray(value)) continue
          const end = last(value) as number
          const rest = key.startsWith('scale') ? 1 : 0
          // A full turn is where it started, too.
          const home = joint === 'spin' ? Math.abs(end) % 360 : Math.abs(end - rest) + rest
          expect(home, `${mood}.${joint}.${key}`).toBe(rest)
        }
      }
    }
  })

  it('lets a buddy do a mood its own way', () => {
    const hover = { body: { y: [0, -5, 0] } }
    expect(choreograph('idle', { idle: hover }).body.y).toEqual([0, -5, 0])
    expect(choreograph('idle').body.y).toBe(0)
  })

  it('settles a held value in a looping mood rather than replaying it', () => {
    const move = choreograph('idle', { idle: { body: { y: 7, scaleY: [1, 1.1, 1], transition: { repeat: Infinity, duration: 2 } } } }).body
    const transition = move.transition as Record<string, { repeat?: number }>
    expect(transition.scaleY.repeat).toBe(Infinity)
    expect(transition.y.repeat).toBeUndefined()
  })

  it('snaps the spin home instantly, since a full turn looks the same', () => {
    expect(choreograph('idle').spin.transition).toMatchObject({ duration: 0 })
  })
})

describe('mirrored', () => {
  it('reverses turns and sideways shifts, and nothing else', () => {
    expect(mirrored({ rotate: [null, 10, -5], x: 3, y: 4, scaleX: 1.1 })).toEqual({ rotate: [null, -10, 5], x: -3, y: 4, scaleX: 1.1 })
  })
})
