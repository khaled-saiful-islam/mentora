/**
 * A game's story as speech-bubble lines (§25): who says what, a few lines at
 * a time — the opening, an island's beat before and after it, the ending.
 * `{buddy}` is the player's own buddy.
 */
import { Plus, Trash } from '@phosphor-icons/react'
import type { StoryLine } from '../api'
import { GrowingText } from './fields'

export const LINE_LIMITS = { who: 40, says: 160 }

export function StoryLines({ label, lines, most, onChange, people }: {
  label: string
  lines: StoryLine[]
  most: number
  onChange: (lines: StoryLine[]) => void
  /** Who can speak: the main character and the buddy. */
  people: string[]
}) {  // fmt: skip
  const set = (n: number, patch: Partial<StoryLine>) => onChange(lines.map((line, i) => (i === n ? { ...line, ...patch } : line)))
  return (
    <fieldset className="min-w-0 rounded-2xl border-2 border-border p-2">
      <legend className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</legend>
      <ol className="space-y-2">
        {lines.map((line, n) => (
          <li key={n} className="flex flex-wrap items-start gap-2 rounded-xl bg-muted/40 p-2">
            <select
              aria-label={`${label}, line ${n + 1}: who says it`}
              value={people.includes(line.who) ? line.who : people[0]}
              onChange={(e) => set(n, { who: e.target.value })}
              className="h-9 max-w-full rounded-full border-2 border-border bg-surface px-3 text-sm font-bold"
            >
              {people.map((who) => (
                <option key={who} value={who}>{who === '{buddy}' ? 'The buddy' : who}</option>
              ))}
            </select>
            <div className="min-w-[min(100%,14rem)] flex-1">
              <GrowingText label={`${label}, line ${n + 1}`} value={line.says} maxLength={LINE_LIMITS.says} placeholder="What they say" onChange={(says) => set(n, { says })} />
            </div>
            <button type="button" aria-label={`Remove line ${n + 1}`} onClick={() => onChange(lines.filter((_, i) => i !== n))} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-destructive">
              <Trash weight="bold" className="size-4" />
            </button>
          </li>
        ))}
      </ol>
      {lines.length < most && (
        <button type="button" onClick={() => onChange([...lines, { who: people[0], says: '' }])} className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary/10">
          <Plus weight="bold" className="size-4" /> Add a line
        </button>
      )}
    </fieldset>
  )
}
