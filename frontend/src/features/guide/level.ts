/**
 * The reading level a student chose — Simpler, Just right or Challenge —
 * remembered on this device so the next guide opens the way they like it.
 * Not saved to the account: it is a comfort, not a record, and a teacher
 * seeing who picked "Simpler" is not something a child signed up for.
 */
import type { ReadingLevel } from '@/features/learning/api'

export const LEVELS: readonly ReadingLevel[] = ['simple', 'core', 'stretch']

const KEY = 'mentora-reading-level'

export function isLevel(value: unknown): value is ReadingLevel {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value)
}

export function rememberedLevel(): ReadingLevel {
  try {
    const stored = localStorage.getItem(KEY)
    return isLevel(stored) ? stored : 'core'
  } catch {
    return 'core'
  }
}

export function rememberLevel(level: ReadingLevel): void {
  try {
    localStorage.setItem(KEY, level)
  } catch {
    // Blocked storage: the choice lasts this visit, which is still something.
  }
}
