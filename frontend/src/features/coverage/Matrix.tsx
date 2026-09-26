/**
 * The coverage map: every topic of the syllabus down the side, the months of
 * the year across, a dot where something was taught (hollow when a live
 * lesson is still on its way), and how the class did at the end of the row.
 * Scrolls sideways inside its own frame on a narrow screen; the topic names
 * stay put.
 */
import { CaretDown } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useCalmMotion } from '@/motion'
import { monthName, type AreaRow, type TaughtItem, type TopicRow } from './api'
import { AREA_LOOKS, KIND_DOTS, TOPIC_LOOKS, scoreTone } from './looks'

export function Matrix({ areas, months, now }: { areas: AreaRow[]; months: string[]; now: string }) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const current = now.slice(0, 7)
  const columns = `minmax(13rem, 18rem) repeat(${months.length}, minmax(3rem, 1fr)) minmax(6.5rem, 7.5rem)`
  const toggle = (id: string) =>
    setClosed((was) => (was.has(id) ? new Set([...was].filter((x) => x !== id)) : new Set([...was, id])))

  return (
    <div className="overflow-x-auto rounded-3xl border border-border bg-surface shadow-sm">
      <div role="table" aria-label="What has been taught, by month" className="grid min-w-max" style={{ gridTemplateColumns: columns }}>
        <div role="row" className="contents">
          <div role="columnheader" className="sticky left-0 z-20 border-b border-border bg-surface px-4 py-3 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Topic
          </div>
          {months.map((month) => (
            <div
              key={month}
              role="columnheader"
              className={cn('border-b border-border px-1 py-3 text-center text-xs font-bold text-muted-foreground', month === current && 'bg-primary/8 text-primary')}
            >
              {monthName(month)}
            </div>
          ))}
          <div role="columnheader" className="border-b border-border px-3 py-3 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Score
          </div>
        </div>

        {areas.map((area, index) => (
          <Area key={area.id} area={area} months={months} current={current} open={!closed.has(area.id)} onToggle={() => toggle(area.id)} delay={index * 0.04} />
        ))}
      </div>
    </div>
  )
}

function Area({
  area,
  months,
  current,
  open,
  onToggle,
  delay,
}: {
  area: AreaRow
  months: string[]
  current: string
  open: boolean
  onToggle: () => void
  delay: number
}) {
  const look = AREA_LOOKS[area.status]
  return (
    <>
      <div role="row" className="contents">
        <div role="cell" className="sticky left-0 z-10 col-span-1 border-b border-border bg-muted/60 px-3 py-2.5 backdrop-blur">
          <motion.button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay }}
            className="flex w-full items-start gap-2 text-left"
          >
            <CaretDown weight="bold" className={cn('mt-1 size-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block break-words font-display font-semibold leading-snug">{area.title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold">
                <span className={cn('rounded-full px-2 py-0.5', look.pill)}>{look.label}</span>
                <span className="text-muted-foreground">
                  {area.taught} of {area.topics.length} taught
                </span>
              </span>
            </span>
          </motion.button>
        </div>
        {months.map((month) => (
          <div key={month} role="cell" aria-hidden className={cn('border-b border-border bg-muted/60', month === current && 'bg-primary/10')} />
        ))}
        <div role="cell" className="border-b border-border bg-muted/60 px-3 py-2.5">
          <Score value={area.mastery} strong />
        </div>
      </div>
      {open && area.topics.map((topic) => <Topic key={topic.id} topic={topic} months={months} current={current} />)}
    </>
  )
}

function Topic({ topic, months, current }: { topic: TopicRow; months: string[]; current: string }) {
  const look = TOPIC_LOOKS[topic.status]
  const byMonth = new Map<string, TaughtItem[]>()
  for (const item of topic.items) byMonth.set(item.month, [...(byMonth.get(item.month) ?? []), item])
  return (
    <div role="row" className="group/row contents">
      <div role="cell" className="sticky left-0 z-10 border-b border-border/70 bg-surface px-4 py-2.5 pl-9 group-hover/row:bg-hover">
        <p className="break-words text-sm font-semibold leading-snug">{topic.title}</p>
        <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-bold', look.pill)}>{look.label}</span>
      </div>
      {months.map((month) => (
        <div
          key={month}
          role="cell"
          className={cn('flex flex-wrap content-center items-center justify-center gap-1 border-b border-border/70 p-1.5 group-hover/row:bg-hover', month === current && 'bg-primary/5')}
        >
          {(byMonth.get(month) ?? []).map((item, i) => (
            <Dot key={`${item.source}-${item.id}`} item={item} delay={i * 0.05} />
          ))}
        </div>
      ))}
      <div role="cell" className="flex items-center border-b border-border/70 px-3 py-2.5 group-hover/row:bg-hover">
        <Score value={topic.mastery} />
      </div>
    </div>
  )
}

function Dot({ item, delay }: { item: TaughtItem; delay: number }) {
  const calm = useCalmMotion()
  const kind = KIND_DOTS[item.kind]
  const when = new Date(item.when).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const label = `${kind.label}: ${item.title}, ${item.planned ? 'planned for' : ''} ${when}`.replace(/\s+/g, ' ')
  return (
    <motion.span
      role="img"
      aria-label={label}
      title={label}
      initial={calm ? false : { scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 18, delay }}
      whileHover={{ scale: 1.5 }}
      className={cn('block size-3 rounded-full', item.planned ? cn('border-2 bg-surface', kind.hollow) : kind.dot)}
    />
  )
}

function Score({ value, strong = false }: { value: number | null; strong?: boolean }) {
  if (value === null) return <span className="text-xs font-bold text-muted-foreground">—</span>
  return (
    <span className="flex w-full items-center gap-2">
      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <motion.span className={cn('block h-full rounded-full', scoreTone(value))} initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ type: 'spring', stiffness: 80, damping: 20 }} />
      </span>
      <span className={cn('tabular-nums text-xs', strong ? 'font-bold' : 'font-semibold')}>{Math.round(value)}%</span>
    </span>
  )
}
