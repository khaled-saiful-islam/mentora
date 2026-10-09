/**
 * Editing a Spot the Mistake round (§26.8): what the lines are ("Ali's
 * working"), and each line — its words, whether it is the mistake, and for a
 * mistake its right version and the wrong ones offered beside it. Every line
 * has its *why*: why it is wrong, or why it is right when a child doubts it.
 *
 * Within what the server keeps: 3 to 8 lines, 1 to 3 of them wrong, a wrong
 * line with one or two decoys.
 */
import { Plus, Trash } from '@phosphor-icons/react'
import type { MistakeContent, MistakeLine } from '@/features/game/rounds'
import { cn } from '@/lib/utils'
import { GrowingText } from './fields'

export const MISTAKE_LIMITS = { title: 80, line: 160, why: 220 }
const LINES = [3, 8] as const
const WRONG = [1, 3] as const
const DECOYS = [1, 2] as const

/** An id for a new line that no other line has. */
function freshId(taken: { id: string }[]): string {
  const ids = new Set(taken.map((p) => p.id))
  let n = taken.length + 1
  while (ids.has(`l${n}`)) n += 1
  return `l${n}`
}

export function MistakeEditor({ content, onChange }: { content: MistakeContent; onChange: (content: MistakeContent) => void }) {
  const lines = content.lines
  const wrong = lines.filter((line) => line.wrong).length
  const setLine = (id: string, patch: Partial<MistakeLine>) => onChange({ ...content, lines: lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) })
  const add = () => onChange({ ...content, lines: [...lines, { id: freshId(lines), text: '', wrong: false, fix: '', decoys: [], why: '' }] })
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-2 border-border p-2">
        <p className="px-2 pt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Whose work it is</p>
        <GrowingText label="Whose work it is" value={content.title} maxLength={MISTAKE_LIMITS.title} placeholder="Ali's working" onChange={(title) => onChange({ ...content, title })} />
      </div>
      <fieldset className="min-w-0 rounded-2xl border-2 border-border p-2">
        <legend className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Lines, in order — {wrong} wrong</legend>
        <ol className="space-y-2">
          {lines.map((line, n) => (
            <LineRow
              key={line.id}
              number={n + 1}
              line={line}
              canWrong={line.wrong || wrong < WRONG[1]}
              canRight={!line.wrong || wrong > WRONG[0]}
              onChange={(patch) => setLine(line.id, patch)}
              onRemove={lines.length > LINES[0] && (!line.wrong || wrong > WRONG[0]) ? () => onChange({ ...content, lines: lines.filter((l) => l.id !== line.id) }) : null}
            />
          ))}
        </ol>
        {lines.length < LINES[1] && (
          <button type="button" onClick={add} className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary/10">
            <Plus weight="bold" className="size-4" /> Add a line
          </button>
        )}
      </fieldset>
    </div>
  )
}

function LineRow({ number, line, canWrong, canRight, onChange, onRemove }: {
  number: number; line: MistakeLine; canWrong: boolean; canRight: boolean; onChange: (patch: Partial<MistakeLine>) => void; onRemove: (() => void) | null
}) {  // fmt: skip
  const label = `Line ${number}`
  const decoys = line.decoys.length ? line.decoys : ['']
  return (
    <li className={cn('flex items-start gap-2 rounded-xl p-2', line.wrong ? 'bg-wrong-soft/60' : 'bg-muted/40')}>
      <span className="mt-2 grid size-7 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">{number}</span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <GrowingText label={label} value={line.text} maxLength={MISTAKE_LIMITS.line} placeholder="What the line says" onChange={(text) => onChange({ text })} />
        <label className="inline-flex min-h-9 items-center gap-2 px-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={line.wrong}
            disabled={line.wrong ? !canRight : !canWrong}
            onChange={(e) => onChange(e.target.checked ? { wrong: true, decoys: line.decoys.length ? line.decoys : [''] } : { wrong: false, fix: '', decoys: [] })}
            className="size-5 accent-primary"
          />
          This line is the mistake
        </label>
        {line.wrong && (
          <>
            <GrowingText label={`${label}: the right version`} value={line.fix} maxLength={MISTAKE_LIMITS.line} placeholder="The line, put right" onChange={(fix) => onChange({ fix })} className="font-semibold text-success" />
            {decoys.map((decoy, n) => (
              <GrowingText
                key={n}
                label={`${label}: wrong fix ${n + 1}`}
                value={decoy}
                maxLength={MISTAKE_LIMITS.line}
                placeholder="Another fix that is still wrong"
                onChange={(value) => onChange({ decoys: decoys.map((d, i) => (i === n ? value : d)) })}
              />
            ))}
            {decoys.length < DECOYS[1] && (
              <button type="button" onClick={() => onChange({ decoys: [...decoys, ''] })} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-primary hover:bg-primary/10">
                <Plus weight="bold" className="size-4" /> Add a wrong fix
              </button>
            )}
          </>
        )}
        <GrowingText
          label={`${label}: why`}
          value={line.why}
          maxLength={MISTAKE_LIMITS.why}
          placeholder={line.wrong ? 'Why it is wrong' : 'Why it is right — said if a child doubts it'}
          onChange={(why) => onChange({ why })}
          className="text-sm text-muted-foreground"
        />
      </div>
      {onRemove && (
        <button type="button" aria-label={`Remove ${label.toLowerCase()}`} onClick={onRemove} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-destructive">
          <Trash weight="bold" className="size-4" />
        </button>
      )}
    </li>
  )
}
