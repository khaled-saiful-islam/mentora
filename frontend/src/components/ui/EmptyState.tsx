import { motion } from 'motion/react'
import { spring } from '@/motion'
import { cn } from '@/lib/utils'

/**
 * Nothing here yet — said kindly, with a picture and the one thing to do next.
 * An empty list is the first thing a new teacher sees; it should invite, not
 * just report.
 */
export function EmptyState({
  art,
  title,
  body,
  action,
  className,
}: {
  art: React.ReactNode
  title: string
  body?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={cn(
        'flex flex-col items-center rounded-[1.75rem] border-2 border-dashed border-border px-6 py-12 text-center',
        className,
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-5"
      >
        {art}
      </motion.div>
      <h3 className="font-display text-2xl font-semibold">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  )
}
