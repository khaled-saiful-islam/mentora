import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { CalendarBlank, ChartBar, LockSimple, LockSimpleOpen, Sparkle, UsersFour, UsersThree } from '@phosphor-icons/react'
import { Alert, Button, ButtonLink, Card, Chip, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { learningApi, type Assignment } from '@/features/learning/api'
import { lookOfKind } from '@/features/learning/kinds'
import { useResource } from '@/hooks/useResource'
import { rise, stagger } from '@/motion'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { EmptyArt } from './EmptyArt'

/** What this class has been given, newest first. */
export function AssignmentsTab({ classId }: { classId: string }) {
  const shared = useResource(`assignments:${classId}`, () => learningApi.assignments(classId))
  const { toast } = useToast()

  async function toggle(assignment: Assignment) {
    try {
      const updated = await learningApi.updateAssignment(assignment.id, { closed: !assignment.closed })
      shared.setData((page) => ({ items: page!.items.map((a) => (a.id === updated.id ? updated : a)) }))
      toast(updated.closed ? 'Closed — no new answers' : 'Open again')
    } catch (error) {
      toast('That did not work', { tone: 'error', body: errorMessage(error) })
    }
  }

  if (shared.error) return <Alert>{shared.error}</Alert>
  if (shared.loading && !shared.data) return <Skeleton className="h-40 rounded-[1.5rem]" />
  const items = shared.data?.items ?? []
  if (items.length === 0) {
    return (
      <EmptyState
        art={<EmptyArt Icon={Sparkle} tone="from-sun-100 to-coral-100" />}
        title="Nothing shared yet"
        body="Make a quiz or flashcards, then share them with this class or one of its groups."
        action={<Link to="/library"><Button>Go to your library</Button></Link>}
      />
    )
  }
  return (
    <motion.ul className="space-y-3" variants={stagger(0.05)} initial="hidden" animate="shown">
      {items.map((a) => {
        const look = lookOfKind(a.kind)
        const overdue = a.due_at && new Date(a.due_at) < new Date()
        return (
          <motion.li key={a.id} variants={rise}>
            <Card className={cn('flex flex-wrap items-center gap-4 p-4', a.closed && 'opacity-70')}>
              <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl shadow-press', look.hero)}>
                <look.Icon weight="duotone" className="size-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-semibold">{a.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                  {a.group_names.length ? (
                    <Chip tone="grape"><UsersFour weight="bold" className="size-3.5" />{a.group_names.join(', ')}</Chip>
                  ) : (
                    <Chip><UsersThree weight="bold" className="size-3.5" />Whole class</Chip>
                  )}
                  <span>{a.audience} {a.audience === 1 ? 'student' : 'students'}</span>
                  {a.due_at && (
                    <Chip tone={overdue ? 'coral' : 'sun'}><CalendarBlank weight="bold" className="size-3.5" />due {new Date(a.due_at).toLocaleDateString()}</Chip>
                  )}
                  {a.kind === 'quiz' && <span>· {a.feedback_mode === 'instant' ? 'feedback after each' : 'feedback at the end'}</span>}
                  <span>· shared {timeAgo(a.created_at)}</span>
                </div>
              </div>
              <ButtonLink to={`/assignments/${a.id}`} size="sm">
                <ChartBar weight="bold" className="size-4" />
                Results
              </ButtonLink>
              <Button variant="outline" size="sm" onClick={() => void toggle(a)}>
                {a.closed ? <LockSimpleOpen weight="bold" className="size-4" /> : <LockSimple weight="bold" className="size-4" />}
                {a.closed ? 'Reopen' : 'Close'}
              </Button>
            </Card>
          </motion.li>
        )
      })}
    </motion.ul>
  )
}
