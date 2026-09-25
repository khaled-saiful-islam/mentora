import { motion } from 'motion/react'
import { useNotifications } from '@/features/notifications/NotificationsProvider'
import { cn } from '@/lib/utils'

/** "Live": this page updates by itself. Quietly says so when the line drops. */
export function LiveBadge({ className }: { className?: string }) {
  const { live } = useNotifications()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
        live ? 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100' : 'bg-muted text-muted-foreground',
        className,
      )}
      title={live ? 'Updates by itself as things happen' : 'Reconnecting — this page will catch up'}
    >
      <span className="relative flex size-2">
        {live && (
          <motion.span
            className="absolute inline-flex size-full rounded-full bg-mint-400"
            animate={{ scale: [1, 2.4], opacity: [0.7, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className={cn('relative inline-flex size-2 rounded-full', live ? 'bg-mint-400' : 'bg-muted-foreground')} />
      </span>
      {live ? 'Live' : 'Reconnecting…'}
    </span>
  )
}
