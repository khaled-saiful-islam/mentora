/**
 * How a game begins (§26.8): five openings, each its own scene for the same
 * story — a comic, a video call from the character, a letter in a bottle, a
 * news flash, a postcard — so no two games start alike. The story writer
 * picks one to suit the story; the maker can change it.
 */
import { CallOpening } from './call'
import { ComicOpening } from './comic'
import { LetterOpening } from './letter'
import { NewsOpening } from './news'
import type { OpeningProps } from './parts'
import { PostcardOpening } from './postcard'

export type Start = 'comic' | 'call' | 'letter' | 'news' | 'postcard'

export const STARTS: Start[] = ['comic', 'call', 'letter', 'news', 'postcard']

export const START_LABELS: Record<Start, string> = {
  comic: 'A comic',
  call: 'A video call',
  letter: 'A letter in a bottle',
  news: 'A news flash',
  postcard: 'A postcard',
}

export const isStart = (value: unknown): value is Start => typeof value === 'string' && (STARTS as string[]).includes(value)

export function Opening({ start, ...props }: OpeningProps & { start: Start }) {
  switch (start) {
    case 'call':
      return <CallOpening {...props} />
    case 'letter':
      return <LetterOpening {...props} />
    case 'news':
      return <NewsOpening {...props} />
    case 'postcard':
      return <PostcardOpening {...props} />
    default:
      return <ComicOpening {...props} />
  }
}

export type { OpeningProps } from './parts'
