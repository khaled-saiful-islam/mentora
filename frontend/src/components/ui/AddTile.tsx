/**
 * The last tile in a grid of things: room for one more. It shows only where
 * it fills a gap in the last row — never alone on a row of its own — so a
 * grid with one class, one group or one lesson does not leave a wide empty
 * stretch beside it.
 */
import { Plus } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { rise } from '@/motion'

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

// Written out whole, so the stylesheet has every one.
const SHOW: Record<Breakpoint, string> = { sm: 'sm:block', md: 'md:block', lg: 'lg:block', xl: 'xl:block', '2xl': '2xl:block' }
const HIDE: Record<Breakpoint, string> = { sm: 'sm:hidden', md: 'md:hidden', lg: 'lg:hidden', xl: 'xl:hidden', '2xl': '2xl:hidden' }
const ORDER: Breakpoint[] = ['sm', 'md', 'lg', 'xl', '2xl']

/** Visible at each breakpoint where `count` leaves the last row short. */
export function fillsGap(count: number, columns: Partial<Record<Breakpoint, number>>): string {
  return cn(
    'hidden',
    ORDER.filter((bp) => columns[bp]).map((bp) => (count % (columns[bp] as number) === 0 ? HIDE[bp] : SHOW[bp])),
  )
}

export function AddTile({
  title,
  hint,
  to,
  onClick,
  count,
  columns,
  className,
}: {
  title: string
  hint: string
  to?: string
  onClick?: () => void
  /** How many things are already in the grid. */
  count: number
  /** The grid's columns at each breakpoint it changes at. */
  columns: Partial<Record<Breakpoint, number>>
  className?: string
}) {
  const body = (
    <>
      <motion.span
        className="grid size-12 shrink-0 place-items-center rounded-2xl bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
        whileHover={{ rotate: 90 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
      >
        <Plus weight="bold" className="size-6" aria-hidden />
      </motion.span>
      <span className="min-w-0">
        <span className="block font-display text-lg font-semibold text-foreground">{title}</span>
        <span className="text-sm">{hint}</span>
      </span>
    </>
  )
  const look =
    'group flex h-full min-h-32 w-full items-center gap-4 rounded-[1.75rem] border-2 border-dashed border-border p-5 text-left text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40'
  return (
    <motion.li variants={rise} className={cn(fillsGap(count, columns), className)}>
      {to ? (
        <Link to={to} className={look}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={look}>
          {body}
        </button>
      )}
    </motion.li>
  )
}
