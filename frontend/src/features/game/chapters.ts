/**
 * A game is played in three chapters (§23), easiest challenges first. The
 * split is the server's (`chapter_sizes` in `app/learning/game.py`), so the
 * story's chapter intros — written from the same split — lead into the right
 * challenges.
 */
import type { GameChapter, GameExtras } from '@/features/learning/api'

export const CHAPTERS = 3

/** As even as it goes; the extra ones in the earlier, easier chapters. */
export function chapterSizes(count: number): number[] {
  const base = Math.floor(Math.max(0, count) / CHAPTERS)
  const extra = Math.max(0, count) % CHAPTERS
  return Array.from({ length: CHAPTERS }, (_, n) => base + (n < extra ? 1 : 0))
}

export interface Chapter<T> extends GameChapter {
  /** 0, 1 or 2. */
  index: number
  items: T[]
  /** Where its first challenge sits in the whole game. */
  start: number
}

/** The challenges, grouped into their chapters. A chapter with none is left
 *  out — a very short game has fewer than three. */
export function chaptersOf<T>(items: T[], extras: Partial<GameExtras> | null | undefined): Chapter<T>[] {
  const told = extras?.story?.chapters ?? []
  const chapters: Chapter<T>[] = []
  let start = 0
  chapterSizes(items.length).forEach((size, index) => {
    const story = told[index]
    if (size > 0) {
      chapters.push({
        index,
        title: story?.title || `Chapter ${index + 1}`,
        intro: story?.intro ?? '',
        outro: story?.outro ?? '',
        items: items.slice(start, start + size),
        start,
      })
    }
    start += size
  })
  return chapters
}

/** Stars for a chapter: three for every challenge right, two for two in
 *  three, one for one in three. */
export function chapterStars(correct: number, total: number): number {
  if (total <= 0) return 0
  const share = correct / total
  if (share >= 1) return 3
  if (share >= 2 / 3) return 2
  return share >= 1 / 3 ? 1 : 0
}

/** The story's words with the player's buddy in them. */
export function told(text: string | null | undefined, buddyName: string): string {
  return (text ?? '').replaceAll('{buddy}', buddyName)
}
