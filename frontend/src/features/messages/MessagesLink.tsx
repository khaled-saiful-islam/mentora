/** The envelope in the header, beside the bell, for parents and teachers:
 *  how many messages wait, on every page and every screen size. */
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { EnvelopeSimple } from '@phosphor-icons/react'
import { useAuth } from '@/lib/auth'
import { can } from '@/lib/user'
import { cn } from '@/lib/utils'
import { useUnreadMessages } from './unread'

export function MessagesLink() {
  const { user } = useAuth()
  const allowed = user !== null && can(user, 'parent_teacher_messages')
  const unread = useUnreadMessages(allowed ? user.id : null)
  const on = useLocation().pathname.startsWith('/messages')
  if (!allowed) return null
  return (
    <Link
      to="/messages"
      aria-label={unread ? `Messages, ${unread} unread` : 'Messages'}
      aria-current={on ? 'page' : undefined}
      className="relative grid size-10 place-items-center rounded-full text-foreground hover:bg-hover"
    >
      <motion.span whileHover={{ y: [0, -3, 0], transition: { duration: 0.35 } }} className="grid place-items-center">
        <EnvelopeSimple weight={unread || on ? 'fill' : 'duotone'} className={cn('size-6', (unread > 0 || on) && 'text-primary')} />
      </motion.span>
      <AnimatePresence>
        {unread > 0 && (
          <motion.span
            key={unread}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: [0.3, 1.35, 1], opacity: 1, transition: { duration: 0.45 } }}
            exit={{ scale: 0.3, opacity: 0 }}
            className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.7rem] font-bold leading-5 text-primary-foreground ring-2 ring-background"
          >
            {unread > 99 ? '99+' : unread}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  )
}
