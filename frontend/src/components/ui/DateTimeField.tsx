/**
 * A date and a time, picked and then confirmed with OK.
 *
 * The browser's own date-time box has no OK: its pop-up stays open until you
 * click somewhere else, so nobody knows when the time is set. This one opens
 * a calendar and a time under the field, and nothing changes until OK.
 * Cancel (or Escape) leaves the value as it was.
 *
 * The value is local time as `YYYY-MM-DDTHH:mm`, like a datetime-local
 * input's, so it drops in where one was.
 */
import { AnimatePresence, motion } from 'motion/react'
import { CalendarBlank, CaretLeft, CaretRight, X } from '@phosphor-icons/react'
import { useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { Button } from './index'
import { Segmented } from './Segmented'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTE_STEP = 5

const pad = (n: number) => String(n).padStart(2, '0')

/** A moment as a datetime-local value, in local time. */
export function localValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Now, to the minute, as a datetime-local value. */
export function localNow(now: Date = new Date()): string {
  return localValue(now)
}

/** A stored ISO time, as a datetime-local value (or '' for none). */
export function localFromIso(iso: string | null | undefined): string {
  return iso ? localValue(new Date(iso)) : ''
}

export function parseLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number)
  return new Date(y, mo - 1, d, h, mi)
}

/** The days to show for a month: whole weeks from Monday, blanks outside it. */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const days = new Date(year, month + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7) cells.push(null)
  return cells
}

/** Where the picker starts when there is no value: the next whole hour. */
export function firstGuess(min: Date | null, now: Date = new Date()): Date {
  const from = min && min > now ? min : now
  const next = new Date(from)
  next.setMinutes(0, 0, 0)
  next.setHours(next.getHours() + 1)
  return next
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** "Thu, 15 Oct, 9:30 AM" — with the year only when it is not this one. */
export function whenText(date: Date, now: Date = new Date()): string {
  const year = date.getFullYear() === now.getFullYear() ? undefined : 'numeric'
  return date.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year, hour: 'numeric', minute: '2-digit' })
}

export function DateTimeField({
  id,
  value,
  onChange,
  min,
  placeholder = 'Pick a date and time',
  clearable = true,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  /** The earliest allowed, as a datetime-local value. */
  min?: string
  placeholder?: string
  /** Offer a way back to no date at all. */
  clearable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const chosen = parseLocal(value)

  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          ref={trigger}
          id={id}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex min-h-12 w-full min-w-0 flex-1 items-center gap-2 rounded-2xl border-2 bg-surface px-4 py-2 text-left text-base font-semibold',
            'transition-[border-color,box-shadow] duration-150 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
            open ? 'border-primary' : 'border-input hover:border-hover-border',
          )}
        >
          <CalendarBlank weight="bold" className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className={cn('min-w-0 flex-1 break-words', !chosen && 'font-normal text-muted-foreground')}>
            {chosen ? whenText(chosen) : placeholder}
          </span>
        </button>
        {clearable && chosen && !open && (
          <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="No date" onClick={() => onChange('')}>
            <X weight="bold" className="size-4" aria-hidden />
          </Button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.snappy}
            className="overflow-hidden"
          >
            <Picker
              initial={chosen ?? firstGuess(min ? parseLocal(min) : null)}
              min={min ? parseLocal(min) : null}
              onCancel={close}
              onOk={(date) => {
                onChange(localValue(date))
                close()
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Picker({ initial, min, onCancel, onOk }: { initial: Date; min: Date | null; onCancel: () => void; onOk: (date: Date) => void }) {
  const [draft, setDraft] = useState(initial)
  const [month, setMonth] = useState({ year: initial.getFullYear(), month: initial.getMonth() })
  const today = new Date()
  const hour12 = draft.getHours() % 12 || 12
  const pm = draft.getHours() >= 12
  const minutes = [...new Set([...Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP), draft.getMinutes()])].sort((a, b) => a - b)
  const tooEarly = min !== null && draft < min
  const monthName = new Date(month.year, month.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const firstMonth = min !== null && month.year === min.getFullYear() && month.month === min.getMonth()

  const set = (patch: { date?: Date; hour12?: number; minute?: number; pm?: boolean }) => {
    const base = patch.date ?? draft
    const h = patch.hour12 ?? hour12
    const isPm = patch.pm ?? pm
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), (h % 12) + (isPm ? 12 : 0), patch.minute ?? draft.getMinutes())
    setDraft(next)
  }
  const shift = (by: number) => {
    const at = new Date(month.year, month.month + by, 1)
    setMonth({ year: at.getFullYear(), month: at.getMonth() })
  }

  return (
    <div
      role="group"
      aria-label="Pick a date and time"
      onKeyDown={(e) => {
        // Escape closes the picker, not the dialog it sits in.
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCancel()
        }
      }}
      className="mt-2 rounded-3xl border-2 border-border bg-surface p-3 shadow-sm sm:p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Last month" disabled={firstMonth} onClick={() => shift(-1)}>
          <CaretLeft weight="bold" className="size-4" aria-hidden />
        </Button>
        <p className="font-display text-lg font-semibold" aria-live="polite">
          {monthName}
        </p>
        <Button type="button" variant="ghost" size="icon" aria-label="Next month" onClick={() => shift(1)}>
          <CaretRight weight="bold" className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1 text-xs font-bold text-muted-foreground">
            {d}
          </span>
        ))}
        {monthGrid(month.year, month.month).map((day, i) => {
          if (!day) return <span key={`blank-${i}`} />
          const picked = sameDay(day, draft)
          const past = min !== null && dayStart(day) < dayStart(min)
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={past}
              aria-pressed={picked}
              aria-label={day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              onClick={() => set({ date: day })}
              className={cn(
                'mx-auto grid aspect-square w-full max-w-11 place-items-center rounded-full text-sm font-bold transition-colors',
                picked ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-hover',
                !picked && sameDay(day, today) && 'ring-2 ring-primary/40',
                past && 'cursor-not-allowed text-muted-foreground/40 hover:bg-transparent',
              )}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-sm font-bold">Time</span>
        <select aria-label="Hour" value={hour12} onChange={(e) => set({ hour12: Number(e.target.value) })} className="h-10 rounded-xl border-2 border-input bg-surface px-2 font-semibold">
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span aria-hidden className="font-bold">
          :
        </span>
        <select aria-label="Minute" value={draft.getMinutes()} onChange={(e) => set({ minute: Number(e.target.value) })} className="h-10 rounded-xl border-2 border-input bg-surface px-2 font-semibold">
          {minutes.map((m) => (
            <option key={m} value={m}>
              {pad(m)}
            </option>
          ))}
        </select>
        <Segmented label="Morning or afternoon" value={pm ? 'pm' : 'am'} onChange={(v) => set({ pm: v === 'pm' })} options={[{ value: 'am', label: 'AM' }, { value: 'pm', label: 'PM' }]} />
      </div>

      <p className={cn('mt-3 break-words text-sm font-semibold', tooEarly ? 'text-destructive' : 'text-muted-foreground')} aria-live="polite">
        {tooEarly ? 'That time has already passed. Pick a later one.' : whenText(draft)}
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={tooEarly} onClick={() => onOk(draft)}>
          OK
        </Button>
      </div>
    </div>
  )
}
