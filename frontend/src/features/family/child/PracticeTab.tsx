/** The child's own practice, and what Mentora made for them. */
import { Barbell, Sparkle } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Alert, Chip, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { lookOfKind, nounOf } from '@/features/learning/kinds'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { rise, stagger } from '@/motion'
import { familyApi, type ChildPractice } from '../api'
import { SectionTitle } from './bits'
import { useChildResource } from './useChild'

export function PracticeTab({ childId, first }: { childId: string; first: string }) {
  const practice = useChildResource(childId, 'practice', () => familyApi.practice(childId))
  if (practice.error) return <Alert>{practice.error}</Alert>
  if (!practice.data) return <Skeleton className="h-64 rounded-[1.75rem]" />
  const items = practice.data.items
  if (items.length === 0) {
    return (
      <EmptyState
        art={<EmptyArt Icon={Barbell} tone="from-kind-family-vivid/30 to-sun-100" />}
        title="No practice yet"
        body={`${first} can make their own practice quizzes and flashcards, and Mentora makes some when a quiz was tricky. They show up here.`}
      />
    )
  }
  const madeFor = items.filter((i) => i.made_for_you)
  const own = items.filter((i) => !i.made_for_you)
  return (
    <div className="space-y-8">
      {madeFor.length > 0 && <Group title="Made for them" note={`From what ${first} found tricky in class.`} items={madeFor} />}
      {own.length > 0 && <Group title={`${first}'s own`} note="Practice sets they made themselves." items={own} />}
    </div>
  )
}

function Group({ title, note, items }: { title: string; note: string; items: ChildPractice[] }) {
  return (
    <section className="space-y-3">
      <SectionTitle title={`${title} · ${items.length}`} note={note} />
      <motion.ul className={cn('grid gap-2', items.length > 1 && '@2xl:grid-cols-2')} variants={stagger(0.04)} initial="hidden" animate="shown">
        {items.map((item) => (
          <PracticeRow key={item.id} item={item} />
        ))}
      </motion.ul>
    </section>
  )
}

function PracticeRow({ item }: { item: ChildPractice }) {
  const kind = lookOfKind(item.kind)
  const making = item.status === 'generating'
  return (
    <motion.li variants={rise} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3">
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', kind.hero)}>
        {item.made_for_you ? <Sparkle weight="fill" className="size-6" aria-hidden /> : <kind.Icon weight="fill" className="size-6" aria-hidden />}
      </span>
      <div className="min-w-[min(100%,12rem)] flex-1">
        <p className="break-words font-bold leading-snug">{item.title}</p>
        <p className="text-sm text-muted-foreground">
          {kind.label} · {making ? 'being made' : nounOf(item.kind, item.item_count)} · {timeAgo(item.updated_at)}
        </p>
      </div>
      {item.best !== null ? (
        <Chip tone="mint">
          Best {Math.round(item.best)}% · {item.tries} {item.tries === 1 ? 'try' : 'tries'}
        </Chip>
      ) : (
        <Chip tone={making ? 'sky' : 'neutral'}>{making ? 'Being made' : 'Not tried yet'}</Chip>
      )}
    </motion.li>
  )
}
