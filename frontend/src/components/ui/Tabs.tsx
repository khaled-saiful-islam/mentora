import { motion } from 'motion/react'
import { useId } from 'react'
import { Link } from 'react-router-dom'
import { spring } from '@/motion'
import { cn } from '@/lib/utils'

export interface TabItem {
  key: string
  label: string
  to: string
  badge?: number
  icon?: React.ReactNode
}

/** Tabs that are links — each tab has a URL, so reload and back both work. */
export function Tabs({ items, active, className }: { items: TabItem[]; active: string; className?: string }) {
  const layoutId = useId()
  return (
    <nav
      aria-label="Sections"
      className={cn('no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1', className)}
    >
      {items.map((item) => {
        const on = item.key === active
        return (
          <Link
            key={item.key}
            to={item.to}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors',
              on ? 'text-primary-foreground' : 'text-muted-foreground hover:bg-hover hover:text-foreground',
            )}
          >
            {on && (
              <motion.span
                layoutId={layoutId}
                transition={spring.snappy}
                className="absolute inset-0 rounded-full bg-primary shadow-sm"
              />
            )}
            <span className="relative inline-flex items-center gap-2">
              {item.icon}
              {item.label}
              {item.badge ? (
                <span
                  className={cn(
                    'grid min-w-5 place-items-center rounded-full px-1.5 text-xs',
                    on ? 'bg-white/25' : 'bg-coral-400 text-white',
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
