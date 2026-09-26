/** Live lessons coming up and done — whether they came, and the notes. */
import { CalendarStar, Notebook } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Alert, Button, Skeleton, Spinner } from '@/components/ui'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { EmptyArt } from '@/features/classes/EmptyArt'
import type { SessionSummary } from '@/features/live/sessions/api'
import { useResource } from '@/hooks/useResource'
import { rise, stagger } from '@/motion'
import { familyApi } from '../api'
import { LessonRow, SectionTitle } from './bits'
import { useChildResource } from './useChild'

export function ScheduleTab({ childId, first }: { childId: string; first: string }) {
  const schedule = useChildResource(childId, 'schedule', () => familyApi.schedule(childId))
  const [notesFor, setNotesFor] = useState<SessionSummary | null>(null)
  if (schedule.error) return <Alert>{schedule.error}</Alert>
  if (!schedule.data) return <Skeleton className="h-64 rounded-[1.75rem]" />
  const { upcoming, past } = schedule.data
  if (upcoming.length === 0 && past.length === 0) {
    return (
      <EmptyState
        art={<EmptyArt Icon={CalendarStar} tone="from-kind-family-vivid/30 to-grape-100" />}
        title="No live lessons yet"
        body={`When a teacher plans a live lesson for ${first}'s group, it appears here with its time.`}
      />
    )
  }
  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <SectionTitle title="Coming up" note={`${first} gets a reminder before each one.`} />
          <motion.ul className="space-y-2" variants={stagger(0.05)} initial="hidden" animate="shown">
            {upcoming.map((lesson) => (
              <LessonRow key={lesson.id} lesson={lesson} />
            ))}
          </motion.ul>
        </section>
      )}
      {past.length > 0 && (
        <section className="space-y-3">
          <SectionTitle title="Already happened" />
          <motion.ul className="space-y-2" variants={stagger(0.05)} initial="hidden" animate="shown">
            {past.map((lesson) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                attended={lesson.attended}
                action={
                  <Button size="sm" variant="outline" onClick={() => setNotesFor(lesson)}>
                    <Notebook weight="bold" className="size-4" aria-hidden /> Notes
                  </Button>
                }
              />
            ))}
          </motion.ul>
        </section>
      )}
      <Dialog open={notesFor !== null} onClose={() => setNotesFor(null)} title={notesFor?.title ?? 'Notes'} description="The key points of each part, as Astra taught them." size="lg">
        {notesFor && <Notes childId={childId} sessionId={notesFor.id} />}
      </Dialog>
    </div>
  )
}

function Notes({ childId, sessionId }: { childId: string; sessionId: string }) {
  const notes = useResource(`child-notes:${childId}:${sessionId}`, () => familyApi.notes(childId, sessionId))
  if (notes.error) return <Alert>{notes.error}</Alert>
  if (!notes.data) return <Spinner />
  return (
    <motion.ol className="space-y-4" variants={stagger(0.05)} initial="hidden" animate="shown">
      {notes.data.parts.map((part, i) => (
        <motion.li key={`${part.title}-${i}`} variants={rise} className="rounded-2xl bg-muted/50 p-4">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Part {i + 1}</p>
          <p className="break-words font-display text-lg font-semibold">{part.title}</p>
          {part.key_points.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {part.key_points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          )}
        </motion.li>
      ))}
    </motion.ol>
  )
}
