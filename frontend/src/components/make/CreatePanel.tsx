import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Sparkle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { GROUPS, type Creatable, type Group } from './creatables'

/** How long each card holds the light before it moves on. */
const SPOTLIGHT_MS = 3200

/**
 * What can be made, on the studio's front page — one group at a time, so
 * eight cards never crowd the screen. Every card plays its little scene; a
 * light moves from card to card, turning the lit one to its next example.
 * Pointing at a card takes the light; choosing it starts that thing with that
 * example.
 */
export function CreatePanel({
  items,
  onPick,
}: {
  items: Creatable[]
  onPick: (item: Creatable, example: string) => void
}) {
  const groups = useMemo(() => GROUPS.filter((g) => items.some((i) => i.group === g.key)), [items])
  const [tab, setTab] = useState<Group>(groups[0]?.key ?? 'learning')
  const shown = items.filter((i) => i.group === tab)

  if (items.length === 0) return null
  const hint = groups.find((g) => g.key === tab)?.hint

  return (
    <section aria-label="Create something" className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <Sparkle weight="fill" className="size-5 text-star" aria-hidden /> Create something
          </h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        {groups.length > 1 && (
          <div role="tablist" aria-label="What to create" className="inline-flex rounded-full border-2 border-border bg-surface p-1">
            {groups.map((g) => {
              const on = g.key === tab
              const count = items.filter((i) => i.group === g.key).length
              return (
                <button
                  key={g.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(g.key)}
                  className={cn('relative rounded-full px-4 py-1.5 text-sm font-bold transition-colors', on ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                >
                  {on && <motion.span layoutId="create-tab" transition={spring.snappy} className="absolute inset-0 rounded-full bg-primary" aria-hidden />}
                  <span className="relative">
                    {g.label} <span className="opacity-70">{count}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          role="tabpanel"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.14 } }}
          transition={spring.gentle}
          className={cn('mt-4 grid gap-4', shown.length > 3 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-3')}
        >
          <Cards items={shown} onPick={onPick} />
        </motion.div>
      </AnimatePresence>
    </section>
  )
}

function Cards({ items, onPick }: { items: Creatable[]; onPick: (item: Creatable, example: string) => void }) {
  const [spot, setSpot] = useState(0)
  const spotRef = useRef(0)
  const [held, setHeld] = useState<number | null>(null)
  const [turn, setTurn] = useState<number[]>(() => items.map(() => 0))

  useEffect(() => {
    if (held !== null || items.length === 0) return
    const timer = window.setInterval(() => {
      // Not while the tab is hidden: a light nobody can see is only work.
      if (document.hidden) return
      const next = (spotRef.current + 1) % items.length
      spotRef.current = next
      setSpot(next)
      setTurn((all) => all.map((n, i) => (i === next ? n + 1 : n)))
    }, SPOTLIGHT_MS)
    return () => window.clearInterval(timer)
  }, [held, items.length])

  const lit = held ?? spot
  return (
    <>
      {items.map((item, index) => {
        const example = item.examples.length ? item.examples[(turn[index] ?? 0) % item.examples.length] : ''
        return (
          <button
            key={item.key}
            type="button"
            data-live={lit === index}
            onClick={() => onPick(item, example)}
            onMouseEnter={() => setHeld(index)}
            onMouseLeave={() => setHeld(null)}
            onFocus={() => setHeld(index)}
            onBlur={() => setHeld(null)}
            aria-label={`${item.label}: ${item.blurb}${example ? `. For example, ${example}` : ''}`}
            className="make-tile group flex h-full min-w-0 flex-col gap-2 p-2.5 pb-4"
            style={{ ['--tile' as string]: item.colour, animationDelay: `${index * 60}ms` }}
          >
            <span aria-hidden className={cn('grid h-24 place-items-center overflow-hidden rounded-2xl', item.stage ?? 'make-stage')}>
              <item.Scene />
            </span>
            <span className="flex items-center justify-between gap-2 px-1.5 pt-1">
              <span className="flex min-w-0 items-center gap-1.5 font-display text-lg font-bold leading-tight" style={{ color: 'var(--tile)' }}>
                <item.Icon weight="duotone" className="size-5 shrink-0" aria-hidden />
                {item.label}
              </span>
              <ArrowUpRight weight="bold" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </span>
            <span className="px-1.5 text-sm leading-snug text-muted-foreground">{item.blurb}</span>
            {example && (
              <span key={example} className="create-example mt-auto px-1.5 text-xs font-semibold leading-snug" style={{ color: 'var(--tile)' }}>
                Try: {example}
              </span>
            )}
          </button>
        )
      })}
    </>
  )
}
