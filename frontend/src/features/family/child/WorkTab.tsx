/** Everything shared with the child, grouped by where it stands. */
import { ListChecks } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Alert, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { familyApi, type ChildWork } from '../api'
import { isLate, SectionTitle, WorkRow } from './bits'
import { useChildResource } from './useChild'
import { stagger } from '@/motion'

const GROUPS: { key: string; title: string; note?: string; pick: (w: ChildWork) => boolean }[] = [
  { key: 'late', title: 'Past due', note: 'Its due date has passed and it isn’t finished.', pick: (w) => isLate(w) },
  { key: 'todo', title: 'To do', pick: (w) => (w.status === 'todo' || w.status === 'in_progress') && !isLate(w) },
  { key: 'done', title: 'Done', pick: (w) => w.status === 'done' },
  { key: 'closed', title: 'Closed', note: 'The teacher closed these before they were finished.', pick: (w) => w.status === 'closed' },
]

export function WorkTab({ childId, first }: { childId: string; first: string }) {
  const work = useChildResource(childId, 'work', () => familyApi.work(childId))
  if (work.error) return <Alert>{work.error}</Alert>
  if (!work.data) return <Skeleton className="h-64 rounded-[1.75rem]" />
  const items = work.data.items
  if (items.length === 0) {
    return (
      <EmptyState
        art={<EmptyArt Icon={ListChecks} tone="from-kind-family-vivid/30 to-mint-100" />}
        title="No work shared yet"
        body={`When ${first}'s teachers share a quiz, a deck or a study guide, it shows up here with its due date.`}
      />
    )
  }
  return (
    <div className="space-y-8">
      {GROUPS.map((group) => {
        const rows = items.filter(group.pick)
        if (rows.length === 0) return null
        return (
          <section key={group.key} className="space-y-3">
            <SectionTitle title={`${group.title} · ${rows.length}`} note={group.note} />
            <motion.ul className="space-y-2" variants={stagger(0.04)} initial="hidden" animate="shown">
              {rows.map((row) => (
                <WorkRow key={row.assignment_id} todo={row} reviewTo={row.review_attempt_id ? `/children/${childId}/attempts/${row.review_attempt_id}` : null} />
              ))}
            </motion.ul>
          </section>
        )
      })}
    </div>
  )
}
