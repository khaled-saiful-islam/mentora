/**
 * What a buddy does when something happens in a game — the one table that
 * turns "that answer was right" into a cheer, a line and a shower of stars.
 */
import type { ParticleKind } from './particles'
import type { Anchor } from './profiles'
import type { BuddyKey, Mood } from './types'
import { pick, VOICES } from './voices'

export type Cue =
  | 'hello'
  | 'correct'
  | 'wrong'
  | 'knew'
  | 'notYet'
  | 'think'
  | 'finishGreat'
  | 'finishGood'
  | 'finishKeep'

export interface CueContext {
  name?: string
  streak?: number
  seed?: number
}

export interface Performance {
  mood: Mood
  line?: string
  burst?: [ParticleKind, number, Anchor]
}

export const STREAK_EVERY = 3

export function performanceFor(cue: Cue, buddy: BuddyKey, context: CueContext = {}): Performance {
  const voice = VOICES[buddy]
  const seed = context.seed ?? Math.random()
  const streak = context.streak ?? 0
  switch (cue) {
    case 'hello':
      return { mood: 'wave', line: `Hi${context.name ? `, ${context.name}` : ''}! ${pick(voice.hello, seed)}` }
    case 'correct':
      if (streak >= STREAK_EVERY && streak % STREAK_EVERY === 0) {
        return {
          mood: 'celebrate',
          line: pick(voice.streak, seed).replace('{n}', String(streak)),
          burst: ['star', 10, 'body'],
        }
      }
      return { mood: 'cheer', line: pick(voice.correct, seed) }
    case 'wrong':
      return { mood: 'oops', line: pick(voice.wrong, seed) }
    case 'knew':
      return { mood: 'happy', line: pick(voice.knew, seed) }
    case 'notYet':
      return { mood: 'listen', line: pick(voice.notYet, seed) }
    case 'think':
      return { mood: 'think' }
    case 'finishGreat':
      return { mood: 'celebrate', line: pick(voice.finish.great, seed), burst: ['confetti', 24, 'top'] }
    case 'finishGood':
      return { mood: 'cheer', line: pick(voice.finish.good, seed) }
    case 'finishKeep':
      return { mood: 'wave', line: pick(voice.finish.keep, seed) }
  }
}
