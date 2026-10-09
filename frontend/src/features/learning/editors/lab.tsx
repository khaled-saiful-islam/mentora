/**
 * Editing The Lab (§26.8): its sliders, what the formula gives, the formula
 * itself — checked as it is typed, with the sliders where they start — and
 * its goals. Show me's answer to each goal (`solution`) is found by the
 * server when the game is saved, so it is left as it is here.
 *
 * Within the sizes the server keeps (app/learning/game.py), so nothing saved
 * here is refused there.
 */
import { Plus, Trash } from '@phosphor-icons/react'
import { useId } from 'react'
import { evaluate } from '@/features/game/rounds/formula'
import type { LabContent, LabControl, LabGoal } from '@/features/game/rounds/types'
import { GrowingText } from './fields'
import { PIECE_LIMITS } from './rounds'

const SIZES = { controls: [1, 3], goals: [1, 3] } as const
const FORMULA_LIMIT = 200

/** An id for a new slider: a name the formula can use, that no other has. */
function freshId(prefix: string, taken: { id: string }[]): string {
  const ids = new Set(taken.map((p) => p.id))
  let n = taken.length + 1
  while (ids.has(`${prefix}${n}`)) n += 1
  return `${prefix}${n}`
}

const shown = (value: number) => (Number.isNaN(value) ? null : String(Number(value.toFixed(2))))

export function LabEditor({ content, onChange }: { content: LabContent; onChange: (content: LabContent) => void }) {
  const setControl = (id: string, patch: Partial<LabControl>) => onChange({ ...content, controls: content.controls.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  const setGoal = (id: string, patch: Partial<LabGoal>) => onChange({ ...content, goals: content.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })
  const addControl = () => onChange({ ...content, controls: [...content.controls, { id: freshId('x', content.controls), label: '', icon: '', unit: '', min: 0, max: 10, step: 1, start: 0 }] })
  const addGoal = () => onChange({ ...content, goals: [...content.goals, { id: freshId('g', content.goals), text: '', low: content.output.min, high: content.output.max, why: '', solution: {} }] })
  return (
    <div className="space-y-3">
      <Group label="Sliders" adding={content.controls.length < SIZES.controls[1] ? 'Add a slider' : null} onAdd={addControl}>
        {content.controls.map((control, n) => (
          <ControlRow key={control.id} number={n + 1} control={control} onChange={(patch) => setControl(control.id, patch)} onRemove={content.controls.length > SIZES.controls[0] ? () => onChange({ ...content, controls: content.controls.filter((c) => c.id !== control.id) }) : null} />
        ))}
      </Group>
      <OutputBox content={content} onChange={onChange} />
      <Group label="Goals, in order" adding={content.goals.length < SIZES.goals[1] ? 'Add a goal' : null} onAdd={addGoal}>
        {content.goals.map((goal, n) => (
          <GoalRow key={goal.id} number={n + 1} goal={goal} unit={content.output.unit} onChange={(patch) => setGoal(goal.id, patch)} onRemove={content.goals.length > SIZES.goals[0] ? () => onChange({ ...content, goals: content.goals.filter((g) => g.id !== goal.id) }) : null} />
        ))}
      </Group>
    </div>
  )
}

function ControlRow({ number, control, onChange, onRemove }: { number: number; control: LabControl; onChange: (patch: Partial<LabControl>) => void; onRemove: (() => void) | null }) {
  const label = `Slider ${number}`
  return (
    <Row label={label} icon={control.icon} onIcon={(icon) => onChange({ icon })} onRemove={onRemove}>
      <GrowingText label={`${label}: its name`} value={control.label} maxLength={PIECE_LIMITS.label} placeholder="Sunlight" onChange={(text) => onChange({ label: text })} />
      <p className="px-3 text-sm text-muted-foreground">
        In the formula: <code className="rounded bg-surface px-1.5 py-0.5 font-bold">{control.id}</code>
      </p>
      <div className="grid grid-cols-2 gap-2 @md:grid-cols-5">
        <TextField label={`${label}: unit`} value={control.unit} limit={16} placeholder="%" onChange={(unit) => onChange({ unit })} />
        <NumberField label={`${label}: least`} value={control.min} onChange={(min) => onChange({ min })} />
        <NumberField label={`${label}: most`} value={control.max} onChange={(max) => onChange({ max })} />
        <NumberField label={`${label}: step`} value={control.step} onChange={(step) => onChange({ step })} />
        <NumberField label={`${label}: starts at`} value={control.start} onChange={(start) => onChange({ start })} />
      </div>
    </Row>
  )
}

/** What the formula gives, the formula, and a check of it as it is typed. */
function OutputBox({ content, onChange }: { content: LabContent; onChange: (content: LabContent) => void }) {
  const id = useId()
  const { output } = content
  const set = (patch: Partial<LabContent['output']>) => onChange({ ...content, output: { ...output, ...patch } })
  const start = Object.fromEntries(content.controls.map((c) => [c.id, c.start]))
  const value = shown(evaluate(content.formula, start))
  return (
    <fieldset className="min-w-0 rounded-2xl border-2 border-border p-2">
      <legend className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">What it gives</legend>
      <ol>
      <Row label="The output" icon={output.icon} onIcon={(icon) => set({ icon })} onRemove={null}>
        <GrowingText label="The output: its name" value={output.label} maxLength={PIECE_LIMITS.label} placeholder="Food made" onChange={(label) => set({ label })} />
        <div className="grid grid-cols-3 gap-2">
          <TextField label="The output: unit" value={output.unit} limit={16} placeholder="g" onChange={(unit) => set({ unit })} />
          <NumberField label="The meter: least" value={output.min} onChange={(min) => set({ min })} />
          <NumberField label="The meter: most" value={output.max} onChange={(max) => set({ max })} />
        </div>
        <label htmlFor={id} className="block px-1 pt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">The formula</label>
        <input id={id} value={content.formula} maxLength={FORMULA_LIMIT} spellCheck={false} onChange={(e) => onChange({ ...content, formula: e.target.value })} placeholder="light * water / 10" className="h-11 w-full rounded-xl border-2 border-border bg-surface px-3 font-mono text-sm focus-visible:border-primary focus-visible:outline-none" />
        <p role="status" className="break-words px-1 text-sm">
          {value === null ? <span className="font-bold text-destructive">With the sliders where they start, this can't be worked out.</span> : <>With the sliders where they start, it gives <b>{value} {output.unit}</b>.</>}
        </p>
        <p className="break-words px-1 text-xs text-muted-foreground">Use the sliders' names, numbers, + − × ÷ as + - * /, ^ for powers, pi, and sin cos tan (in degrees) sqrt abs min max.</p>
      </Row>
      </ol>
    </fieldset>
  )
}

function GoalRow({ number, goal, unit, onChange, onRemove }: { number: number; goal: LabGoal; unit: string; onChange: (patch: Partial<LabGoal>) => void; onRemove: (() => void) | null }) {
  const label = `Goal ${number}`
  return (
    <Row label={label} onRemove={onRemove}>
      <GrowingText label={label} value={goal.text} maxLength={PIECE_LIMITS.piece} placeholder="Make 100 to 140 g of food" onChange={(text) => onChange({ text })} />
      <div className="grid grid-cols-2 gap-2">
        <NumberField label={`${label}: from${unit ? ` (${unit})` : ''}`} value={goal.low} onChange={(low) => onChange({ low })} />
        <NumberField label={`${label}: to${unit ? ` (${unit})` : ''}`} value={goal.high} onChange={(high) => onChange({ high })} />
      </div>
      <GrowingText label={`${label}: why`} value={goal.why} maxLength={PIECE_LIMITS.why} placeholder="Why — said when they let go short of it" onChange={(why) => onChange({ why })} className="text-sm text-muted-foreground" />
    </Row>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const id = useId()
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block px-1 text-xs font-bold text-muted-foreground">{label.split(': ').pop()}</label>
      <input id={id} type="number" step="any" aria-label={label} value={Number.isFinite(value) ? value : ''} onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} className="h-10 w-full min-w-0 rounded-xl border-2 border-border bg-surface px-2 text-sm tabular-nums focus-visible:border-primary focus-visible:outline-none" />
    </div>
  )
}

function TextField({ label, value, limit, placeholder, onChange }: { label: string; value: string; limit: number; placeholder: string; onChange: (value: string) => void }) {
  const id = useId()
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block px-1 text-xs font-bold text-muted-foreground">{label.split(': ').pop()}</label>
      <input id={id} aria-label={label} value={value} maxLength={limit} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-10 w-full min-w-0 rounded-xl border-2 border-border bg-surface px-2 text-sm focus-visible:border-primary focus-visible:outline-none" />
    </div>
  )
}

function Group({ label, adding, onAdd, children }: { label: string; adding: string | null; onAdd: () => void; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-2xl border-2 border-border p-2">
      <legend className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</legend>
      <ol className="space-y-2">{children}</ol>
      {adding && (
        <button type="button" onClick={onAdd} className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary/10">
          <Plus weight="bold" className="size-4" /> {adding}
        </button>
      )}
    </fieldset>
  )
}

function Row({ label, icon, onIcon, onRemove, children }: { label: string; icon?: string; onIcon?: (icon: string) => void; onRemove: (() => void) | null; children: React.ReactNode }) {
  return (
    <li className="flex list-none items-start gap-2 rounded-xl bg-muted/40 p-2">
      {onIcon && <input aria-label={`${label}: its picture`} value={icon ?? ''} maxLength={PIECE_LIMITS.icon} onChange={(e) => onIcon(e.target.value)} className="size-11 shrink-0 rounded-xl bg-surface text-center text-2xl" />}
      <div className="min-w-0 flex-1 space-y-1.5">{children}</div>
      {onRemove && (
        <button type="button" aria-label={`Remove ${label.toLowerCase()}`} onClick={onRemove} className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-destructive">
          <Trash weight="bold" className="size-4" />
        </button>
      )}
    </li>
  )
}
