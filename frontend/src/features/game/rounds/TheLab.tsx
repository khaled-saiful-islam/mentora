/**
 * The Lab (§26.8): one to three sliders drive a formula, and the child moves
 * them to bring what it gives into the goal's green zone — and keep it there
 * a moment. The output shows as a big meter with the zone on it and a picture
 * that grows with it; a Form student also gets the graph. Letting go outside
 * the zone has the buddy say why, and "a bit higher" or "too much"; Show me
 * slides the controls to an answer the server proved reaches it.
 */
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle } from '@phosphor-icons/react'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { pop, spring } from '@/motion'
import { evaluate } from './formula'
import { ReadIt, useFinish, useLater, useShowMe } from './parts'
import type { Shuffled } from './shuffle'
import type { Band, LabContent, LabControl, LabGoal, RoundProps } from './types'

type Values = Record<string, number>
type Output = LabContent['output']

/** How long the output must stay in the zone for the goal to count. */
export const HOLD_MS = 800
/** The buddy says why at most this often while the child is still trying. */
const SAY_EVERY_MS = 4000
/** Show me's slide to the answer, and the steps it takes. */
const SLIDE_MS = 1500
const SLIDE_STEPS = 15
const CHEER_MS = 1400
const MOVING_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const within = (value: number, goal: LabGoal) => !Number.isNaN(value) && value >= goal.low && value <= goal.high

/** A number as the child reads it: up to two decimals, a dash when it can't be worked out. */
export function shown(value: number): string {
  return Number.isNaN(value) ? '—' : String(Number(value.toFixed(2)))
}

function startOf(controls: LabControl[]): Values {
  return Object.fromEntries(controls.map((c) => [c.id, clamp(c.start, c.min, c.max)]))
}

/** Where Show me slides to: the server's answer for the goal, for the controls it names. */
function answerFor(goal: LabGoal, controls: LabControl[], from: Values): Values {
  return Object.fromEntries(
    controls.map((c) => [c.id, c.id in goal.solution ? clamp(goal.solution[c.id], c.min, c.max) : from[c.id]]),
  )
}

const blend = (from: Values, to: Values, t: number): Values =>
  Object.fromEntries(Object.keys(to).map((id) => [id, t >= 1 ? to[id] : from[id] + (to[id] - from[id]) * t]))

export function TheLab({ content, band, calm, say, sound, showMe, onMove, onDone }: RoundProps<LabContent> & Shuffled) {
  const { controls, goals, output, formula } = content
  const [values, setValues] = useState(() => startOf(controls))
  const lab = useGoals({ content, values, say, sound, onMove })
  const [showing, setShowing] = useState(false)
  const later = useLater()
  const value = evaluate(formula, values)
  useFinish(goals.length > 0 && lab.at >= goals.length, onDone)

  useShowMe(showMe, () => {
    if (!lab.goal || showing) return
    const from = lab.latest.current
    const to = answerFor(lab.goal, controls, from)
    const steps = calm ? 1 : SLIDE_STEPS
    setShowing(true)
    for (let n = 1; n <= steps; n += 1) later(() => lab.set(setValues, blend(from, to, n / steps)), (SLIDE_MS / steps) * n)
    later(() => setShowing(false), SLIDE_MS + 50)
  })

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
        <section aria-label="What happens" className="min-w-0 space-y-4">
          <GoalCard goal={lab.goal} at={lab.at} total={goals.length} cheer={lab.cheer} band={band} calm={calm} say={say} />
          <Meter value={value} output={output} goal={lab.goal} nudge={lab.goal && !within(value, lab.goal) ? lab.nudge : null} calm={calm} />
          {band === 'secondary' && controls.length > 0 && <Graph formula={formula} controls={controls} values={values} output={output} goal={lab.goal} />}
        </section>
        <section aria-label="The controls" className="min-w-0 space-y-3">
          {controls.map((control) => (
            <LabSlider key={control.id} control={control} value={values[control.id]} band={band} disabled={showing || !lab.goal} onChange={(id, v) => lab.set(setValues, { ...lab.latest.current, [id]: v })} onRelease={lab.released} />
          ))}
        </section>
      </div>
    </div>
  )
}

/** The goals in turn: reached once the output holds in the zone; a slip
 *  (once per goal) and the buddy's why when the child lets go outside it. */
function useGoals({ content, values, say, sound, onMove }: {
  content: LabContent; values: Values; say: (text: string) => void; sound: RoundProps<LabContent>['sound']; onMove: RoundProps<LabContent>['onMove']
}) {  // fmt: skip
  const { goals, formula } = content
  const [at, setAt] = useState(0)
  const [cheer, setCheer] = useState(false)
  const [nudge, setNudge] = useState<string | null>(null)
  const latest = useRef(values)
  const slipped = useRef(new Set<string>())
  const said = useRef(Number.NEGATIVE_INFINITY)
  const later = useLater()
  const goal = goals[at] ?? null
  const inside = goal !== null && within(evaluate(formula, values), goal)

  useHold(inside, goal?.id ?? null, () => {
    if (!goal) return
    sound('correct')
    onMove({ piece: goal.id, right: true })
    setNudge(null)
    setCheer(true)
    later(() => setCheer(false), CHEER_MS)
    setAt((n) => n + 1)
  })

  function released() {
    const value = evaluate(formula, latest.current)
    if (!goal || within(value, goal)) return
    setNudge(Number.isNaN(value) ? null : value < goal.low ? 'A bit higher!' : 'Too much!')
    if (Date.now() - said.current >= SAY_EVERY_MS) {
      said.current = Date.now()
      say(goal.why)
    }
    if (slipped.current.has(goal.id)) return
    slipped.current = new Set(slipped.current).add(goal.id)
    onMove({ piece: goal.id, right: false })
  }

  /** New slider values, kept where a let-go reads them at once. */
  function set(update: (values: Values) => void, next: Values) {
    latest.current = next
    update(next)
  }

  return { at, goal, cheer, nudge, latest, released, set }
}

/** `onHold` once `inside` has stayed true for HOLD_MS on the same goal. */
function useHold(inside: boolean, goalId: string | null, onHold: () => void) {
  const latest = useRef(onHold)
  useEffect(() => {
    latest.current = onHold
  })
  useEffect(() => {
    if (!inside || goalId === null) return
    const timer = window.setTimeout(() => latest.current(), HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [inside, goalId])
}

function GoalCard({ goal, at, total, cheer, band, calm, say }: {
  goal: LabGoal | null; at: number; total: number; cheer: boolean; band: Band; calm: boolean; say: (text: string) => void
}) {  // fmt: skip
  return (
    <div className="rounded-3xl bg-surface/95 p-4 shadow-sm" aria-live="polite">
      <p className="text-sm font-bold uppercase tracking-wide text-primary">{goal ? `Goal ${at + 1} of ${total}` : 'Every goal reached!'}</p>
      {goal && (
        <div className="mt-1 flex items-start gap-2">
          <p className="min-w-0 flex-1 break-words font-display text-xl font-semibold sm:text-2xl">{goal.text}</p>
          {band === 'early' && <ReadIt text={goal.text} say={say} />}
        </div>
      )}
      <AnimatePresence>
        {cheer && (
          <motion.p variants={pop} initial={calm ? false : 'hidden'} animate="shown" exit={{ opacity: 0 }} className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-correct-soft px-3 py-1 font-display font-bold text-success">
            <CheckCircle weight="fill" className="size-5" aria-hidden />
            Goal reached!
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Where a value sits on the output's range, as a percentage. */
function place(value: number, output: Output): number {
  const span = output.max - output.min || 1
  return clamp(((value - output.min) / span) * 100, 0, 100)
}

function Meter({ value, output, goal, nudge, calm }: { value: number; output: Output; goal: LabGoal | null; nudge: string | null; calm: boolean }) {
  const at = Number.isNaN(value) ? 0 : place(value, output)
  const label = `${shown(value)} ${output.unit}`.trim()
  return (
    <div className="rounded-3xl bg-surface/95 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Picture icon={output.icon} fraction={at / 100} calm={calm} />
        <div className="min-w-0">
          <p className="break-words text-sm font-bold uppercase tracking-wide text-muted-foreground">{output.label}</p>
          <p className="break-words font-display text-4xl font-bold tabular-nums">{label}</p>
        </div>
      </div>
      <div role="meter" aria-label={output.label} aria-valuemin={output.min} aria-valuemax={output.max} aria-valuenow={Number.isNaN(value) ? undefined : value} aria-valuetext={label} className="relative mt-4 h-8 rounded-full bg-muted">
        {goal && <div aria-hidden className="absolute inset-y-0 rounded-full border-2 border-correct bg-correct/40" style={{ left: `${place(goal.low, output)}%`, width: `${Math.max(2, place(goal.high, output) - place(goal.low, output))}%` }} />}
        {!Number.isNaN(value) && (
          <motion.div aria-hidden className="absolute -inset-y-1.5 w-2.5 -translate-x-1/2 rounded-full bg-primary shadow-md" animate={{ left: `${at}%` }} initial={false} transition={calm ? { duration: 0 } : spring.snappy} />
        )}
      </div>
      <p className="mt-1 flex justify-between gap-2 text-xs font-semibold text-muted-foreground" aria-hidden>
        <span>{shown(output.min)}</span>
        <span>{shown(output.max)}</span>
      </p>
      {nudge && <p className="mt-2 font-display text-lg font-bold text-primary" aria-live="polite">{nudge}</p>}
    </div>
  )
}

/** The output's picture, bigger as it grows — still, for calm motion. */
function Picture({ icon, fraction, calm }: { icon: string; fraction: number; calm: boolean }) {
  const scale = 0.6 + fraction * 0.9
  return (
    <span aria-hidden className="grid size-24 shrink-0 place-items-center text-6xl leading-none">
      <motion.span animate={{ scale }} initial={false} transition={calm ? { duration: 0 } : spring.gentle}>
        {icon || '🔬'}
      </motion.span>
    </span>
  )
}

// The graph's box, in its own units.
const W = 320
const H = 170
const PAD = 30
const SAMPLES = 48

/** How the output changes along the first control, the others where they are. */
function Graph({ formula, controls, values, output, goal }: { formula: string; controls: LabControl[]; values: Values; output: Output; goal: LabGoal | null }) {
  const first = controls[0]
  const span = first.max - first.min || 1
  const x = (v: number) => PAD + ((v - first.min) / span) * (W - PAD - 8)
  const y = (v: number) => H - PAD - (place(v, output) / 100) * (H - PAD - 8)
  const points = Array.from({ length: SAMPLES + 1 }, (_, n) => first.min + (span * n) / SAMPLES).map((at) => [at, evaluate(formula, { ...values, [first.id]: at })] as const)
  const path = points.reduce((d, [at, v], n) => (Number.isNaN(v) ? d : `${d}${n === 0 || Number.isNaN(points[n - 1][1]) ? 'M' : 'L'}${x(at).toFixed(1)},${y(v).toFixed(1)} `), '')
  const now = evaluate(formula, values)
  return (
    <figure className="rounded-3xl bg-surface/95 p-3 shadow-sm">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`How ${output.label} changes with ${first.label}`} className="w-full">
        {goal && <rect x={PAD} width={W - PAD - 8} y={y(goal.high)} height={Math.max(2, y(goal.low) - y(goal.high))} className="fill-correct/25" />}
        <line x1={PAD} y1={H - PAD} x2={W - 8} y2={H - PAD} className="stroke-border" strokeWidth={2} />
        <line x1={PAD} y1={8} x2={PAD} y2={H - PAD} className="stroke-border" strokeWidth={2} />
        <path d={path} className="fill-none stroke-primary" strokeWidth={3} strokeLinejoin="round" />
        {!Number.isNaN(now) && <circle cx={x(values[first.id])} cy={y(now)} r={6} className="fill-primary stroke-surface" strokeWidth={2} />}
        <text x={(W + PAD) / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px] font-semibold">{`${first.label}${first.unit ? ` (${first.unit})` : ''}`}</text>
        <text x={10} y={H / 2} textAnchor="middle" transform={`rotate(-90 10 ${H / 2})`} className="fill-muted-foreground text-[11px] font-semibold">{output.label}</text>
      </svg>
    </figure>
  )
}

// A big, easy slider: a thumb a finger can find, on a clear track.
const SLIDER = cn(
  'h-12 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none',
  '[&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted',
  '[&::-webkit-slider-thumb]:-mt-[18px] [&::-webkit-slider-thumb]:size-12 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md',
  '[&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted',
  '[&::-moz-range-thumb]:size-12 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:bg-primary',
  'focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-ring focus-visible:[&::-moz-range-thumb]:ring-4 focus-visible:[&::-moz-range-thumb]:ring-ring',
)

function LabSlider({ control, value, band, disabled, onChange, onRelease }: {
  control: LabControl; value: number; band: Band; disabled: boolean; onChange: (id: string, value: number) => void; onRelease: () => void
}) {  // fmt: skip
  const id = useId()
  const reading = `${shown(value)} ${control.unit}`.trim()
  return (
    <div className="rounded-3xl bg-surface/95 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className={cn('flex min-w-0 items-center gap-2 font-display font-semibold', band === 'early' ? 'text-2xl' : 'text-lg')}>
          {control.icon && <span className="text-3xl leading-none" aria-hidden>{control.icon}</span>}
          <span className="min-w-0 break-words">{control.label}</span>
        </label>
        <span className="font-display text-xl font-bold tabular-nums" aria-hidden>{reading}</span>
      </div>
      <input
        id={id}
        type="range"
        min={control.min}
        max={control.max}
        step={control.step > 0 ? control.step : 'any'}
        value={value}
        disabled={disabled}
        aria-valuetext={reading}
        onChange={(e) => onChange(control.id, Number(e.target.value))}
        onPointerUp={onRelease}
        onKeyUp={(e) => MOVING_KEYS.has(e.key) && onRelease()}
        className={cn(SLIDER, 'mt-2')}
      />
    </div>
  )
}
