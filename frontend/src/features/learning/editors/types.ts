import type { Item, Skill, Source } from '../api'

export interface ItemEditorProps<T extends Item> {
  item: T
  skills: Skill[]
  sources: Source[]
  onChange: (item: T) => void
}

/** What an editor for one kind brings: how to draw an item, a blank one, and
 *  what makes one incomplete (the same rules the server applies). */
export interface KindEditor<T extends Item> {
  Editor: (props: ItemEditorProps<T>) => React.ReactNode
  blank: (skill: string) => T
  problem: (item: T) => string | null
}
