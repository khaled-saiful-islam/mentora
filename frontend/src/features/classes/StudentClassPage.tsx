/**
 * A class, as a student sees it: who teaches it, which groups they are in,
 * and everything shared with them there — to do first, done after.
 */
import { motion } from 'motion/react'
import { CaretLeft, HourglassMedium, Sparkle, UsersThree } from '@phosphor-icons/react'
import { useParams } from 'react-router-dom'
import { Alert, ButtonLink, Chip, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { playApi } from '@/features/play/api'
import { TodoCard } from '@/features/play/TodoCard'
import { useResource } from '@/hooks/useResource'
import { lookOf } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { Page, stagger } from '@/motion'
import { classesApi } from './api'
import { EmptyArt } from './EmptyArt'
import { useLive } from '@/lib/bus'

export default function StudentClassPage() {
  const { classId = '' } = useParams()
  const classes = useResource('my-classes', () => classesApi.mine())
  const work = useResource(`my-work-${classId}`, () => playApi.assignments())
  useLive(['assignments', 'classes'], (m) => {
    if (m.class_id && m.class_id !== classId) return
    void work.reload()
    void classes.reload()
  })
  const room = classes.data?.items.find((c) => c.class_id === classId)
  const mine = (work.data ?? []).filter((t) => t.class_id === classId)
  const open = mine.filter((t) => t.status === 'todo' || t.status === 'in_progress')
  const rest = mine.filter((t) => t.status === 'done' || t.status === 'closed')

  if (classes.data && !room) {
    return (
      <Page className="mx-auto max-w-xl px-4 py-16">
        <Alert>That class isn't one of yours.</Alert>
        <ButtonLink to="/classes" variant="outline" className="mt-6">Back to my classes</ButtonLink>
      </Page>
    )
  }

  const look = lookOf(room?.theme ?? 'grape')
  return (
    <Page className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <ButtonLink to="/classes" variant="ghost" size="sm" className="-ml-3">
        <CaretLeft weight="bold" className="size-4" />
        My classes
      </ButtonLink>
      {!room ? (
        <Skeleton className="mt-3 h-36 rounded-[1.75rem]" />
      ) : (
        <div className={cn('relative mt-3 overflow-hidden rounded-[1.75rem] p-6 md:p-8', look.hero, look.onHero)}>
          <p className="font-bold opacity-85">{room.subject ?? 'Class'}</p>
          <h1 className="font-display text-4xl font-semibold">{room.class_name}</h1>
          <p className="mt-1 opacity-90">with {room.teacher_name}</p>
          {room.groups.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {room.groups.map((group) => (
                <Chip key={group} className="bg-white/25 text-inherit">{group}</Chip>
              ))}
            </div>
          )}
          <motion.span aria-hidden className="absolute -right-4 -bottom-6 opacity-20" animate={{ rotate: [0, 6, 0] }} transition={{ duration: 6, repeat: Infinity }}>
            <UsersThree weight="duotone" className="size-40" />
          </motion.span>
        </div>
      )}

      {work.error && <Alert className="mt-6">{work.error}</Alert>}
      {room?.status === 'pending' ? (
        <EmptyState
          className="mt-8"
          art={<EmptyArt Icon={HourglassMedium} tone="from-sun-100 to-grape-100" />}
          title="Waiting for your teacher"
          body={`${room.teacher_name} will let you in soon. You'll see everything they share right here.`}
        />
      ) : !work.data ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-44 rounded-[1.75rem]" />
          ))}
        </div>
      ) : mine.length === 0 ? (
        <EmptyState
          className="mt-8"
          art={<EmptyArt Icon={Sparkle} tone="from-grape-100 to-mint-100" />}
          title="Nothing shared yet"
          body="When your teacher shares a quiz or flashcards with this class, it shows up here — and on your home page."
        />
      ) : (
        <>
          <Section title="To do" count={open.length} empty="All done here. Nice!">
            {open.map((todo) => (
              <TodoCard key={todo.assignment_id} todo={todo} showClass={false} />
            ))}
          </Section>
          {rest.length > 0 && (
            <Section title="Done" count={rest.length}>
              {rest.map((todo) => (
                <TodoCard key={todo.assignment_id} todo={todo} showClass={false} />
              ))}
            </Section>
          )}
        </>
      )}
    </Page>
  )
}

function Section({ title, count, empty, children }: { title: string; count: number; empty?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl font-semibold">
        {title} <span className="text-muted-foreground">· {count}</span>
      </h2>
      {count === 0 && empty ? (
        <p className="mt-2 text-muted-foreground">{empty}</p>
      ) : (
        <motion.ul className="mt-4 grid gap-4 sm:grid-cols-2" variants={stagger(0.07)} initial="hidden" animate="shown">
          {children}
        </motion.ul>
      )}
    </section>
  )
}
