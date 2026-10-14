/**
 * Editing a Say It round (§28.3.5): two to five lines for a child to read
 * aloud — a word or a short sentence each, in words only — with an emoji and
 * what each means.
 */
import { Plus, Trash } from '@phosphor-icons/react'
import type { SayContent, SayLine } from '@/features/game/rounds'
import { GrowingText } from './fields'

export const SAY_LIMITS = { text: 80, why: 220, icon: 16, words: 8 }
const LINES = [2, 5] as const

function freshId(taken: { id: string }[]): string {
  const ids = new Set(taken.map((p) => p.id))
  let n = taken.length + 1
  while (ids.has(`l${n}`)) n += 1
  return `l${n}`
}

export function SayEditor({ content, onChange }: { content: SayContent; onChange: (content: SayContent) => void }) {
  const lines = content.lines
  const setLine = (id: string, patch: Partial<SayLine>) => onChange({ lines: lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) })
  return (
    <fieldset className="min-w-0 rounded-2xl border-2 border-border p-2">
      <legend className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Lines to read aloud</legend>
      <ol className="space-y-2">
        {lines.map((line, n) => (
          <li key={line.id} className="flex flex-wrap items-start gap-2 rounded-xl bg-muted/40 p-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface text-sm font-bold">{n + 1}</span>
            <input aria-label={`Line ${n + 1} emoji`} value={line.icon} maxLength={SAY_LIMITS.icon} onChange={(e) => setLine(line.id, { icon: e.target.value })} className="h-9 w-14 rounded-lg border-2 border-border bg-surface text-center" />
            <div className="min-w-[min(100%,14rem)] flex-1 space-y-1">
              <GrowingText label={`Line ${n + 1}`} value={line.text} maxLength={SAY_LIMITS.text} placeholder="A word, or a short sentence (no digits)" onChange={(text) => setLine(line.id, { text })} className="font-semibold" />
              <GrowingText label={`What line ${n + 1} means`} value={line.why} maxLength={SAY_LIMITS.why} placeholder="What it means" onChange={(why) => setLine(line.id, { why })} className="text-sm" />
            </div>
            {lines.length > LINES[0] && (
              <button type="button" aria-label={`Remove line ${n + 1}`} onClick={() => onChange({ lines: lines.filter((l) => l.id !== line.id) })} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-destructive">
                <Trash className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ol>
      {lines.length < LINES[1] && (
        <button type="button" onClick={() => onChange({ lines: [...lines, { id: freshId(lines), text: '', icon: '', why: '' }] })} className="mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-primary hover:bg-hover">
          <Plus weight="bold" className="size-4" /> Add a line
        </button>
      )}
    </fieldset>
  )
}

/** What is wrong with the lines as written, or null. */
export function sayProblem(content: SayContent): string | null {
  for (const line of content.lines) {
    const text = line.text.trim()
    if (!text) return 'Write every line.'
    if (/\d/.test(text)) return 'Write numbers as words, so they can be heard: "tiga", not "3".'
    if (text.split(/\s+/).length > SAY_LIMITS.words) return 'Keep each line to 8 words or fewer.'
  }
  return null
}
