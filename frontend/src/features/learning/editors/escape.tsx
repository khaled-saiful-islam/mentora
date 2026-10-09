/**
 * Editing an Escape Room round (§26.8): two to four doors, each a puzzle
 * whose answer is its code — a number typed on a keypad, a word spelled with
 * letter tiles, or one of a few options — and why, said when it opens or a
 * wrong code is tried.
 */
import { Plus, Trash } from '@phosphor-icons/react'
import type { EscapeContent, EscapeDoor } from '@/features/game/rounds'
import { GrowingText } from './fields'

export const ESCAPE_LIMITS = { puzzle: 300, answer: 40, option: 60, why: 220, icon: 16 }
const DOORS = [2, 4] as const
const OPTIONS = [3, 4] as const
const KINDS: { value: EscapeDoor['kind']; label: string }[] = [
  { value: 'number', label: 'A number (keypad)' },
  { value: 'word', label: 'A word (letter tiles)' },
  { value: 'choice', label: 'One of a few options' },
]

/** An id for a new door that no other door has. */
function freshId(taken: { id: string }[]): string {
  const ids = new Set(taken.map((p) => p.id))
  let n = taken.length + 1
  while (ids.has(`d${n}`)) n += 1
  return `d${n}`
}

export function EscapeEditor({ content, onChange }: { content: EscapeContent; onChange: (content: EscapeContent) => void }) {
  const doors = content.doors
  const setDoor = (id: string, patch: Partial<EscapeDoor>) => onChange({ doors: doors.map((d) => (d.id === id ? { ...d, ...patch } : d)) })
  const add = () => onChange({ doors: [...doors, { id: freshId(doors), puzzle: '', icon: '', kind: 'number', answer: '', options: [], why: '' }] })
  return (
    <fieldset className="min-w-0 rounded-2xl border-2 border-border p-2">
      <legend className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Doors, in order</legend>
      <ol className="space-y-2">
        {doors.map((door, n) => (
          <DoorRow
            key={door.id}
            number={n + 1}
            door={door}
            onChange={(patch) => setDoor(door.id, patch)}
            onRemove={doors.length > DOORS[0] ? () => onChange({ doors: doors.filter((d) => d.id !== door.id) }) : null}
          />
        ))}
      </ol>
      {doors.length < DOORS[1] && (
        <button type="button" onClick={add} className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary/10">
          <Plus weight="bold" className="size-4" /> Add a door
        </button>
      )}
    </fieldset>
  )
}

function DoorRow({ number, door, onChange, onRemove }: { number: number; door: EscapeDoor; onChange: (patch: Partial<EscapeDoor>) => void; onRemove: (() => void) | null }) {
  const label = `Door ${number}`
  // Switching to options starts them with the answer among them.
  const kind = (value: EscapeDoor['kind']) => onChange(value === 'choice' ? { kind: value, options: door.options.length ? door.options : [door.answer, '', ''] } : { kind: value, options: [] })
  const setOption = (n: number, value: string) => {
    const options = door.options.map((o, i) => (i === n ? value : o))
    onChange(door.options[n] === door.answer ? { options, answer: value } : { options })
  }
  return (
    <li className="flex items-start gap-2 rounded-xl bg-muted/40 p-2">
      <input aria-label={`${label}: its picture`} value={door.icon} maxLength={ESCAPE_LIMITS.icon} onChange={(e) => onChange({ icon: e.target.value })} className="size-11 shrink-0 rounded-xl bg-surface text-center text-2xl" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <GrowingText label={`${label}: the puzzle`} value={door.puzzle} maxLength={ESCAPE_LIMITS.puzzle} placeholder="The puzzle whose answer opens it" onChange={(puzzle) => onChange({ puzzle })} />
        <select aria-label={`${label}: how the code is entered`} value={door.kind} onChange={(e) => kind(e.target.value as EscapeDoor['kind'])} className="h-9 w-full max-w-full rounded-full border-2 border-border bg-surface px-3 text-sm font-bold sm:w-auto">
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        {door.kind === 'choice' ? (
          <fieldset className="min-w-0 space-y-1">
            <legend className="px-3 text-xs font-bold text-muted-foreground">Options — tick the answer</legend>
            {door.options.map((option, n) => (
              <div key={n} className="flex items-center gap-2">
                <input type="radio" name={`${door.id}-answer`} aria-label={`${label}: option ${n + 1} is the answer`} checked={option !== '' && option === door.answer} onChange={() => onChange({ answer: option })} className="size-5 shrink-0 accent-primary" />
                <div className="min-w-0 flex-1">
                  <GrowingText label={`${label}: option ${n + 1}`} value={option} maxLength={ESCAPE_LIMITS.option} placeholder="An option" onChange={(value) => setOption(n, value)} />
                </div>
              </div>
            ))}
            {door.options.length < OPTIONS[1] && (
              <button type="button" onClick={() => onChange({ options: [...door.options, ''] })} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-primary hover:bg-primary/10">
                <Plus weight="bold" className="size-4" /> Add an option
              </button>
            )}
          </fieldset>
        ) : (
          <GrowingText label={`${label}: the code`} value={door.answer} maxLength={ESCAPE_LIMITS.answer} placeholder={door.kind === 'number' ? 'A number, like 12 or 3/4' : 'A word'} onChange={(answer) => onChange({ answer })} className="font-semibold" />
        )}
        <GrowingText label={`${label}: why`} value={door.why} maxLength={ESCAPE_LIMITS.why} placeholder="Why — said when it opens, or a wrong code is tried" onChange={(why) => onChange({ why })} className="text-sm text-muted-foreground" />
      </div>
      {onRemove && (
        <button type="button" aria-label={`Remove ${label.toLowerCase()}`} onClick={onRemove} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-destructive">
          <Trash weight="bold" className="size-4" />
        </button>
      )}
    </li>
  )
}
