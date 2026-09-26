/**
 * A parent's children, in their settings (§20): who they follow, and the way
 * to each one's page or to connect another. Disconnecting stays on the
 * child's card at home, behind its confirmation.
 */
import { ArrowRight, HeartStraight, Plus } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Alert, Card, Skeleton } from '@/components/ui'
import { BuddyAvatar } from '@/features/buddies/BuddyAvatar'
import { useResource } from '@/hooks/useResource'
import { useLive } from '@/lib/bus'
import { rise, stagger } from '@/motion'
import { familyApi } from './api'

export function ChildrenCard() {
  const children = useResource('settings-children', () => familyApi.children())
  useLive(['family'], () => void children.reload())
  const items = children.data?.items ?? []

  return (
    <Card className="mt-8 overflow-hidden">
      <div className="flex items-center gap-3 bg-gradient-to-br from-kind-family-vivid/15 to-transparent p-6 pb-4">
        <motion.span
          className="grid size-11 place-items-center rounded-2xl bg-kind-family-vivid text-white shadow-press"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.2 }}
        >
          <HeartStraight weight="fill" className="size-6" aria-hidden />
        </motion.span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold">My children</h2>
          <p className="text-sm text-muted-foreground">Who you follow in Mentora. Each child connects you with their own family code.</p>
        </div>
      </div>
      <div className="space-y-3 p-6 pt-2">
        {children.error ? (
          <Alert>{children.error}</Alert>
        ) : !children.data ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : (
          <>
            {items.length > 0 && (
              <motion.ul className="space-y-2" variants={stagger(0.06)} initial="hidden" animate="shown">
                {items.map((child) => (
                  <motion.li key={child.id} variants={rise}>
                    <Link to={`/children/${child.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-border p-3 transition-colors hover:border-hover-border">
                      <BuddyAvatar buddy={child.buddy} size={44} />
                      <span className="min-w-[min(100%,12rem)] flex-1">
                        <span className="block break-words font-bold leading-snug">{child.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {[child.grade_label, `you're their ${child.label}`].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                        See everything <ArrowRight weight="bold" className="size-4" aria-hidden />
                      </span>
                    </Link>
                  </motion.li>
                ))}
              </motion.ul>
            )}
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
              <Plus weight="bold" className="size-4" aria-hidden />
              {items.length ? 'Connect another child' : 'Connect to your child'}
            </Link>
          </>
        )}
      </div>
    </Card>
  )
}
