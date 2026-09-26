import { Link, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { SignOut } from '@phosphor-icons/react'
import { Wordmark } from '@/brand/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Bell } from '@/features/notifications/Bell'
import { WorkTray } from '@/features/work/WorkTray'
import { useAuth } from '@/lib/auth'
import { spring } from '@/motion'
import { nameOf } from '@/lib/user'
import { cn } from '@/lib/utils'
import { navFor } from './nav'

/**
 * The frame around every page that is not the chat: navigation down the side
 * on a desktop, a tab bar along the bottom on a phone, and the bell and the
 * person always in the corner.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const items = navFor(user)

  return (
    <div className="min-h-dvh bg-background md:grid md:grid-cols-[15.5rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-sidebar px-3 py-5 md:flex">
        <Link to="/" className="px-2">
          <Wordmark tile />
        </Link>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
          {items.map((item) => {
            const on = item.matches(pathname)
            return (
              <Link
                key={item.key}
                to={item.to}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-3 rounded-2xl px-3 py-2.5 font-bold transition-colors',
                  on ? 'text-primary' : 'text-sidebar-foreground hover:bg-hover',
                )}
              >
                {on && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={spring.snappy}
                    className="absolute inset-0 rounded-2xl bg-grape-100 dark:bg-grape-800/40"
                  />
                )}
                <item.Icon weight={on ? 'fill' : 'duotone'} className="relative size-6" />
                <span className="relative">{item.label}</span>
              </Link>
            )
          })}
        </nav>
        {user && (
          <div className="mt-auto flex items-center gap-2 rounded-2xl bg-surface p-2 shadow-sm">
            <Avatar name={nameOf(user)} seed={user.id} className="size-9" />
            <Link to="/profile" className="min-w-0 flex-1">
              <p className="break-words text-sm font-bold">{nameOf(user)}</p>
              <p className="break-words text-xs capitalize text-muted-foreground">
                {user.role === 'student' && user.grade_label ? user.grade_label : user.role}
              </p>
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Sign out"
              title="Sign out"
              className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground"
            >
              <SignOut weight="bold" className="size-5" />
            </button>
          </div>
        )}
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur md:px-8">
          <Link to="/" className="md:hidden">
            <Wordmark tile />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <WorkTray align="right" />
            <Bell align="right" />
          </div>
        </header>
        <div className="flex-1 pb-24 md:pb-10">{children}</div>
      </div>

      <TabBar pathname={pathname} />
    </div>
  )
}

function TabBar({ pathname }: { pathname: string }) {
  const { user } = useAuth()
  const items = navFor(user).filter((item) => item.key !== 'admin' && item.tab !== false)
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 backdrop-blur md:hidden"
    >
      {items.map((item) => {
        const on = item.matches(pathname)
        return (
          <Link
            key={item.key}
            to={item.to}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-xs font-bold',
              on ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <motion.span animate={on ? { y: -2, scale: 1.12 } : { y: 0, scale: 1 }} transition={spring.bouncy}>
              <item.Icon weight={on ? 'fill' : 'duotone'} className="size-7" />
            </motion.span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
