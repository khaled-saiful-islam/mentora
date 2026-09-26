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
        // Picture beside the words once there is room: half the height, and
        // no wide dashed box around a thin column.
        'flex flex-col items-center gap-5 rounded-[1.75rem] border-2 border-dashed border-border px-6 py-8 text-center',
        'sm:flex-row sm:justify-center sm:gap-8 sm:text-left',
        className,
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="shrink-0"
      >
        {art}
      </motion.div>
      <div className="min-w-0 max-w-md">
        <h3 className="font-display text-2xl font-semibold">{title}</h3>
        {body && <p className="mt-2 text-muted-foreground">{body}</p>}
        {action && <div className="mt-5 flex justify-center sm:justify-start">{action}</div>}
      </div>
    </motion.div>
  )
}
