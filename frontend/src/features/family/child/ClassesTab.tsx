/** Each class, its teacher, and what the class has covered — with how the
 *  child did on every topic. The same report a teacher can send home. */
import { CaretDown, ChalkboardTeacher, UsersThree } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Alert, Button, Skeleton, Spinner } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import type { StudentClass } from '@/features/classes/api'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { Report } from '@/features/coverage/ReportPage'
import { MessageButton, useContacts } from '@/features/messages/MessageButton'
import type { Contact } from '@/features/messages/api'
import { useResource } from '@/hooks/useResource'
import { useAuth } from '@/lib/auth'
import { lookOf } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { rise, stagger } from '@/motion'
import { familyApi } from '../api'
import { useChildResource } from './useChild'

export function ClassesTab({ childId, first }: { childId: string; first: string }) {
  const classes = useChildResource(childId, 'classes', () => familyApi.classes(childId))
  const contacts = useContacts(useAuth().user)
  if (classes.error) return <Alert>{classes.error}</Alert>
  if (!classes.data) return <Skeleton className="h-48 rounded-[1.75rem]" />
  const rooms = classes.data.items
  if (rooms.length === 0) {
    return (
      <EmptyState
        art={<EmptyArt Icon={UsersThree} tone="from-kind-family-vivid/30 to-sky-100" />}
        title={`${first} isn't in a class yet`}
        body="When they join one with their teacher's code, it shows up here with the teacher and what the class covers."
      />
    )
  }
  return (
    <motion.ul className="space-y-4" variants={stagger(0.06)} initial="hidden" animate="shown">
      {rooms.map((room) => (
        <ClassRow
          key={room.class_id}
          childId={childId}
          room={room}
          teachers={contacts.filter((c) => c.student_id === childId && c.class_ids.includes(room.class_id))}
        />
      ))}
    </motion.ul>
  )
}

function ClassRow({ childId, room, teachers }: { childId: string; room: StudentClass; teachers: Contact[] }) {
  const [open, setOpen] = useState(false)
  const look = lookOf(room.theme)
  return (
    <motion.li variants={rise} className="overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', look.hero, look.onHero)}>
          <ChalkboardTeacher weight="duotone" className="size-7" aria-hidden />
        </span>
        <div className="min-w-[min(100%,14rem)] flex-1">
          <p className="break-words font-display text-xl font-semibold leading-snug">{room.class_name}</p>
          <p className="text-sm text-muted-foreground">{[room.subject, `with ${room.teacher_name}`].filter(Boolean).join(' · ')}</p>
        </div>
        <MessageButton contacts={teachers} label={`Message ${room.teacher_name}`} />
        <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide what they cover' : 'What the class covers'}
          <motion.span animate={{ rotate: open ? 180 : 0 }} className="inline-flex">
            <CaretDown weight="bold" className="size-4" aria-hidden />
          </motion.span>
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-border p-4">
              <Coverage childId={childId} classId={room.class_id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

function Coverage({ childId, classId }: { childId: string; classId: string }) {
  const report = useResource(`child-coverage:${childId}:${classId}`, () => familyApi.coverage(childId, classId))
  if (report.error) return <Alert>{report.error}</Alert>
  if (!report.data) return <div className="grid place-items-center py-8"><Spinner /></div>
  if (report.data.areas.length === 0) {
    return <p className="text-muted-foreground">The teacher hasn't set out this year's syllabus yet, so there's no map to show.</p>
  }
  return <Report report={report.data} inApp />
}
