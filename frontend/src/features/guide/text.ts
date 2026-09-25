/**
 * Working with a guide's words — kept pure so it can be tested: which words
 * to mark as the ones to know, where each sentence starts and ends for
 * reading aloud, and the paragraphs of a section.
 */
import type { GuideTerm } from '@/features/learning/api'

export interface Piece {
  text: string
  /** Set on the first time a word to know appears. */
  term?: GuideTerm
}

const LETTER = String.raw`[\p{L}\p{N}]`

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * A paragraph cut around its words to know, each marked the first time it
 * appears — every time would be a page of underlines. Whole words only, any
 * case, the longest first so "water cycle" wins over "water".
 */
export function markTerms(text: string, terms: GuideTerm[], seen: Set<string> = new Set()): Piece[] {
  const usable = terms.filter((t) => t.term.trim()).sort((a, b) => b.term.length - a.term.length)
  if (!usable.length || !text) return text ? [{ text }] : []
  const pattern = new RegExp(`(?<!${LETTER})(${usable.map((t) => escape(t.term)).join('|')})(?!${LETTER})`, 'giu')
  const pieces: Piece[] = []
  let at = 0
  for (const match of text.matchAll(pattern)) {
    const word = match[0]
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    const term = usable.find((t) => t.term.toLowerCase() === key)
    if (!term || match.index === undefined) continue
    seen.add(key)
    if (match.index > at) pieces.push({ text: text.slice(at, match.index) })
    pieces.push({ text: word, term })
    at = match.index + word.length
  }
  if (at < text.length) pieces.push({ text: text.slice(at) })
  return pieces
}

export function paragraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
}

/** The [start, end) of the sentence containing character `index`, for the
 *  words being read aloud. Out of range gives the nearest sentence. */
export function sentenceAt(text: string, index: number): [number, number] {
  if (!text) return [0, 0]
  const at = Math.max(0, Math.min(index, text.length - 1))
  const before = text.slice(0, at)
  const ends = [...before.matchAll(/[.!?](?=\s)|\n\n/g)]
  const last = ends.at(-1)
  let start = last ? (last.index ?? 0) + last[0].length : 0
  while (start < text.length && /\s/.test(text[start])) start += 1
  const rest = text.slice(at).search(/[.!?](\s|$)|\n\n/)
  const end = rest === -1 ? text.length : at + rest + 1
  return [start, Math.min(end, text.length)]
}

/** A plain-words reading time: children read slower than the usual 200. */
export function minutesToRead(words: number, perMinute = 120): number {
  return Math.max(1, Math.round(words / perMinute))
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/** How a word's translation is labelled: a Malay guide translates to English. */
export function translationLabel(language: string): string {
  return language === 'ms' ? 'In English' : 'In Bahasa Melayu'
}
