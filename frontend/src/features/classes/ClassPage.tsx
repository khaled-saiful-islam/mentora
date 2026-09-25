import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Archive, ArrowLeft, ArrowCounterClockwise, PencilSimple, QrCode, UserCirclePlus, UsersFour, UsersThree } from '@phosphor-icons/react'
import { Alert, Button, Skeleton } from '@/components/ui'
import { Confirm } from '@/components/ui/Confirm'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { useResource } from '@/hooks/useResource'
import { Page, spring } from '@/motion'
import { lookOf } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { useOn } from '@/lib/bus'
import { useNotifications } from '@/features/notifications/NotificationsProvider'
import { classesApi, type ClassDraft, type ClassRoom } from './api'
import { ClassFormDialog } from './ClassFormDialog'
import { GroupsTab } from './GroupsTab'
import { InviteTab } from './InviteTab'
import { RequestsTab } from './RequestsTab'
import { StudentsTab } from './StudentsTab'

const TABS = ['students', 'requests', 'groups', 'invite'] as const
type Tab = (typeof TABS)[number]

export default function ClassPage() {
  const { classId = '', tab = 'students' } = useParams()
  // Bumped whenever this class changes somewhere else — a decision made from
  // the bell, or a join request arriving live — so every tab refetches.
  const [version, setVersion] = useState(0)
  const room = useResource(`class:${classId}`, () => classesApi.get(classId))
  const { arrivals, latestArrival } = useNotifications()
  useOn('class-changed', (changed) => changed === classId && setVersion((v) => v + 1))
  useEffect(() => {
    if (latestArrival?.payload.class_id === classId) setVersion((v) => v + 1)
  }, [arrivals]) // only on a new arrival
  const { reload } = room
  useEffect(() => {
    // Refetch in place, without blanking the hero back to a skeleton.
    if (version > 0) void reload()
  }, [version, reload])
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  if (!TABS.includes(tab as Tab)) return <Navigate to={`/classes/${classId}`} replace />
  if (room.error) {
    return (
      <Page className="mx-auto max-w-3xl px-4 py-10">
        <Alert>{room.error}</Alert>
        <Link to="/classes" className="mt-4 inline-block font-bold text-primary">
          Back to classes
        </Link>
      </Page>
    )
  }
  const data = room.data
  const refreshCounts = () => void room.reload()

  async function save(draft: ClassDraft) {
    room.setData(await classesApi.update(classId, draft))
    toast('Saved')
  }

  async function toggleArchive(current: ClassRoom) {
    setArchiving(false)
    if (current.archived) {
      room.setData(await classesApi.restore(classId))
      toast(`${current.name} is back`)
    } else {
      await classesApi.archive(classId)
      toast(`${current.name} archived`, { tone: 'info', body: 'Results are kept. Restore it any time.' })
      navigate('/classes')
    }
  }

  const base = `/classes/${classId}`
  return (
    <Page className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
      <Link to="/classes" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft weight="bold" className="size-4" />
        All classes
      </Link>

      {!data ? (
        <Skeleton className="mt-4 h-40 rounded-[2rem]" />
      ) : (
        <Hero room={data} onEdit={() => setEditing(true)} onArchive={() => setArchiving(true)} />
      )}

      <Tabs
        className="mt-6"
        active={tab}
        items={[
          { key: 'students', label: 'Students', to: base, icon: <UsersThree weight="bold" className="size-4" /> },
          { key: 'requests', label: 'Requests', to: `${base}/requests`, badge: data?.pending, icon: <UserCirclePlus weight="bold" className="size-4" /> },
          { key: 'groups', label: 'Groups', to: `${base}/groups`, icon: <UsersFour weight="bold" className="size-4" /> },
          { key: 'invite', label: 'Invite', to: `${base}/invite`, icon: <QrCode weight="bold" className="size-4" /> },
        ]}
      />

      <motion.div key={tab} className="mt-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring.gentle}>
        {tab === 'students' && <StudentsTab key={version} classId={classId} onChange={refreshCounts} />}
        {tab === 'requests' && <RequestsTab key={version} classId={classId} onChange={refreshCounts} />}
        {tab === 'groups' && <GroupsTab key={version} classId={classId} onChange={refreshCounts} />}
        {tab === 'invite' && data && <InviteTab room={data} />}
      </motion.div>

      <ClassFormDialog open={editing} initial={data} onClose={() => setEditing(false)} onSave={save} />
      {archiving && data && (
        <Confirm
          title={data.archived ? `Restore ${data.name}?` : `Archive ${data.name}?`}
          body={
            data.archived
              ? 'It comes back to your class list, with everyone still in it.'
              : "Students won't be able to join, and it leaves your list. Everything students earned is kept."
          }
          confirmLabel={data.archived ? 'Restore' : 'Archive'}
          destructive={!data.archived}
          onConfirm={() => void toggleArchive(data)}
          onCancel={() => setArchiving(false)}
        />
      )}
    </Page>
  )
}

function Hero({ room, onEdit, onArchive }: { room: ClassRoom; onEdit: () => void; onArchive: () => void }) {
  const look = lookOf(room.theme)
  return (
    <motion.section
      className={cn('relative mt-4 overflow-hidden rounded-[2rem] p-6 shadow-press sm:p-8', look.hero, look.onHero)}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring.gentle}
    >
      <span className="blob -right-10 -top-16 size-56 bg-white/40" aria-hidden />
      <div className="relative flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-bold opacity-85">{[room.subject, room.grade_label].filter(Boolean).join(' · ') || 'Class'}</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{room.name}</h1>
          <p className="mt-2 font-bold opacity-90">
            {room.students} {room.students === 1 ? 'student' : 'students'} · {room.groups}{' '}
            {room.groups === 1 ? 'group' : 'groups'}
            {room.archived && ' · archived'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit} className="bg-white/90 text-grape-900 hover:bg-white">
            <PencilSimple weight="bold" className="size-4" />
            Edit
          </Button>
          <Button variant="secondary" size="sm" onClick={onArchive} className="bg-white/20 text-current hover:bg-white/30">
            {room.archived ? <ArrowCounterClockwise weight="bold" className="size-4" /> : <Archive weight="bold" className="size-4" />}
            {room.archived ? 'Restore' : 'Archive'}
          </Button>
        </div>
      </div>
    </motion.section>
  )
}
