/**
 * Editing a Detective Case (§26.8): the question, the clue cards — each with
 * its words, a small table if it needs one, and what it shows — the suspects
 * with why each is or is not the answer, and which suspect is the answer and
 * which clue proves it.
 *
 * Within the sizes the server keeps (app/learning/game.py), so nothing saved
 * here is refused there.
 */
import { Plus, Trash } from '@phosphor-icons/react'
import { useId } from 'react'
import { cn } from '@/lib/utils'
import type { CaseClue, CaseContent, CaseSuspect } from '@/features/game/rounds/types'
import { GrowingText } from './fields'
import { PIECE_LIMITS } from './rounds'

const SIZES = { clues: [3, 6], suspects: [2, 4], rows: 5, cols: 4 } as const
const TEXT_LIMIT = 400
const CELL_LIMIT = 40

/** An id for a new piece that no other piece has. */
function freshId(prefix: string, taken: { id: string }[]): string {
  const ids = new Set(taken.map((p) => p.id))
  let n = taken.length + 1
  while (ids.has(`${prefix}${n}`)) n += 1
  return `${prefix}${n}`
}

export function CaseEditor({ content, onChange }: { content: CaseContent; onChange: (content: CaseContent) => void }) {
  const setClue = (id: string, patch: Partial<CaseClue>) => onChange({ ...content, clues: content.clues.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  const setSuspect = (id: string, patch: Partial<CaseSuspect>) => onChange({ ...content, suspects: content.suspects.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  const dropClue = (id: string) => {
    const clues = content.clues.filter((c) => c.id !== id)
    onChange({ ...content, clues, key: content.key === id ? clues[0].id : content.key })
  }
  const dropSuspect = (id: string) => {
    const suspects = content.suspects.filter((s) => s.id !== id)
    onChange({ ...content, suspects, answer: content.answer === id ? suspects[0].id : content.answer })
  }
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-2 border-border p-2">
        <p className="px-2 pt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">The question</p>
        <GrowingText label="The question" value={content.question} maxLength={PIECE_LIMITS.piece} placeholder="Which car broke the speed limit?" onChange={(question) => onChange({ ...content, question })} />
      </div>
      <Group label="Suspects — people or things" adding={content.suspects.length < SIZES.suspects[1] ? 'Add a suspect' : null} onAdd={() => onChange({ ...content, suspects: [...content.suspects, { id: freshId('w', content.suspects), name: '', icon: '', claim: '', why: '' }] })}>
        {content.suspects.map((suspect, n) => (
          <SuspectRow key={suspect.id} number={n + 1} suspect={suspect} onChange={(patch) => setSuspect(suspect.id, patch)} onRemove={content.suspects.length > SIZES.suspects[0] ? () => dropSuspect(suspect.id) : null} />
        ))}
      </Group>
      <Group label="Clues" adding={content.clues.length < SIZES.clues[1] ? 'Add a clue' : null} onAdd={() => onChange({ ...content, clues: [...content.clues, { id: freshId('k', content.clues), title: '', icon: '', text: '', rows: [], why: '' }] })}>
        {content.clues.map((clue, n) => (
          <ClueRow key={clue.id} number={n + 1} clue={clue} onChange={(patch) => setClue(clue.id, patch)} onRemove={content.clues.length > SIZES.clues[0] ? () => dropClue(clue.id) : null} />
        ))}
      </Group>
      <div className="grid gap-2 rounded-2xl border-2 border-border p-2 @md:grid-cols-2">
        <Picker label="The answer" value={content.answer} options={content.suspects.map((s, n) => ({ id: s.id, label: s.name || `Suspect ${n + 1}` }))} onChange={(answer) => onChange({ ...content, answer })} />
        <Picker label="The clue that proves it" value={content.key} options={content.clues.map((c, n) => ({ id: c.id, label: c.title || `Clue ${n + 1}` }))} onChange={(key) => onChange({ ...content, key })} />
      </div>
    </div>
  )
}

function SuspectRow({ number, suspect, onChange, onRemove }: { number: number; suspect: CaseSuspect; onChange: (patch: Partial<CaseSuspect>) => void; onRemove: (() => void) | null }) {
  const label = `Suspect ${number}`
  return (
    <Row label={label} icon={suspect.icon} onIcon={(icon) => onChange({ icon })} onRemove={onRemove}>
      <GrowingText label={`${label}: name`} value={suspect.name} maxLength={PIECE_LIMITS.label} placeholder="The red car" onChange={(name) => onChange({ name })} />
      <GrowingText label={`${label}: what they say`} value={suspect.claim} maxLength={PIECE_LIMITS.piece} placeholder="I was going slowly." onChange={(claim) => onChange({ claim })} />
      <Why label={label} value={suspect.why} placeholder="Why it is the answer — or why it is not" onChange={(why) => onChange({ why })} />
    </Row>
  )
}

function ClueRow({ number, clue, onChange, onRemove }: { number: number; clue: CaseClue; onChange: (patch: Partial<CaseClue>) => void; onRemove: (() => void) | null }) {
  const label = `Clue ${number}`
  return (
    <Row label={label} icon={clue.icon} onIcon={(icon) => onChange({ icon })} onRemove={onRemove}>
      <GrowingText label={`${label}: title`} value={clue.title} maxLength={PIECE_LIMITS.label} placeholder="The traffic camera" onChange={(title) => onChange({ title })} />
      <GrowingText label={`${label}: what it says`} value={clue.text} maxLength={TEXT_LIMIT} placeholder="Each car was timed over 100 m." onChange={(text) => onChange({ text })} />
      <RowsEditor label={label} rows={clue.rows} onChange={(rows) => onChange({ rows })} />
      <Why label={label} value={clue.why} placeholder="What it shows — said when it is picked and does not prove it" onChange={(why) => onChange({ why })} />
    </Row>
  )
}

/** A clue's small table: its first row the headings, up to five rows of four. */
function RowsEditor({ label, rows, onChange }: { label: string; rows: string[][]; onChange: (rows: string[][]) => void }) {
  const cols = Math.max(0, ...rows.map((r) => r.length))
  const setCell = (r: number, c: number, value: string) => onChange(rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)))
  if (rows.length === 0) {
    return <AddButton label="Add a table" onClick={() => onChange([['', ''], ['', '']])} />
  }
  return (
    <div className="space-y-1.5 rounded-xl bg-surface p-2">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Table — the first row is the headings</p>
      {rows.map((row, r) => (
        <div key={r} className="flex items-center gap-1.5">
          <div className="grid min-w-0 flex-1 gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }, (_, c) => (
              <input key={c} aria-label={`${label}, table ${r === 0 ? 'heading' : `row ${r}`}, column ${c + 1}`} value={row[c] ?? ''} maxLength={CELL_LIMIT} onChange={(e) => setCell(r, c, e.target.value)} className={cn('h-10 w-full min-w-0 rounded-lg border-2 border-border bg-surface px-2 text-sm focus-visible:border-primary focus-visible:outline-none', r === 0 && 'font-bold')} />
            ))}
          </div>
          <button type="button" aria-label={`${label}: remove table row ${r + 1}`} onClick={() => onChange(rows.length > 2 ? rows.filter((_, i) => i !== r) : [])} className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-destructive">
            <Trash weight="bold" className="size-4" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-1">
        {rows.length < SIZES.rows && <AddButton label="Add a row" onClick={() => onChange([...rows, Array.from({ length: cols }, () => '')])} />}
        {cols < SIZES.cols && <AddButton label="Add a column" onClick={() => onChange(rows.map((row) => [...row, '']))} />}
        {cols > 1 && <AddButton label="Remove the last column" onClick={() => onChange(rows.map((row) => row.slice(0, cols - 1)))} />}
      </div>
    </div>
  )
}

function Picker({ label, value, options, onChange }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (id: string) => void }) {
  const id = useId()
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-11 w-full min-w-0 rounded-full border-2 border-border bg-surface px-3 text-sm font-bold">
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary/10">
      <Plus weight="bold" className="size-4" /> {label}
    </button>
  )
}

function Group({ label, adding, onAdd, children }: { label: string; adding: string | null; onAdd: () => void; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-2xl border-2 border-border p-2">
      <legend className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</legend>
      <ol className="space-y-2">{children}</ol>
      {adding && <AddButton label={adding} onClick={onAdd} />}
    </fieldset>
  )
}

function Row({ label, icon, onIcon, onRemove, children }: { label: string; icon: string; onIcon: (icon: string) => void; onRemove: (() => void) | null; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 rounded-xl bg-muted/40 p-2">
      <input aria-label={`${label}: its picture`} value={icon} maxLength={PIECE_LIMITS.icon} onChange={(e) => onIcon(e.target.value)} className="size-11 shrink-0 rounded-xl bg-surface text-center text-2xl" />
      <div className="min-w-0 flex-1 space-y-1.5">{children}</div>
      {onRemove && (
        <button type="button" aria-label={`Remove ${label.toLowerCase()}`} onClick={onRemove} className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-destructive">
          <Trash weight="bold" className="size-4" />
        </button>
      )}
    </li>
  )
}

function Why({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (why: string) => void }) {
  return <GrowingText label={`${label}: why`} value={value} maxLength={PIECE_LIMITS.why} placeholder={placeholder} onChange={onChange} className="text-sm text-muted-foreground" />
}
