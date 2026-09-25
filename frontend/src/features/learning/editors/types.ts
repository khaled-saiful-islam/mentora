import type { Item, Skill, Source } from '../api'

export interface ItemEditorProps<T extends Item> {
  item: T
  skills: Skill[]
  sources: Source[]
  onChange: (item: T) => void
}

/** A kind's parts that are not items — a study guide's opening and ending. */
export interface ExtrasEditor<E> {
  Editor: (props: { extras: E; onChange: (extras: E) => void }) => React.ReactNode
  /** Filled in from what the server sent, which may be partial. */
  from: (raw: Record<string, unknown>) => E
  title: string
}

/** What an editor for one kind brings: how to draw an item, a blank one, and
 *  what makes one incomplete (the same rules the server applies). */
export interface KindEditor<T extends Item> {
  Editor: (props: ItemEditorProps<T>) => React.ReactNode
  blank: (skill: string) => T
  problem: (item: T) => string | null
  extras?: ExtrasEditor<unknown>
  /** Worth seeing as a student would before sharing: it has a reader. */
  previewable?: boolean
}
