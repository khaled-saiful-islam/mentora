import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Archive, ChalkboardTeacher, Plus } from '@phosphor-icons/react'
import { Alert, Button, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { useResource } from '@/hooks/useResource'
import { Page, stagger } from '@/motion'
import { classesApi, type ClassDraft } from './api'
import { ClassCard } from './ClassCard'
import { ClassFormDialog } from './ClassFormDialog'
import { EmptyArt } from './EmptyArt'
import { useLive } from '@/lib/bus'

export default function TeacherClassesPage() {
  const [view, setView] = useState<'active' | 'archived'>('active')
  const [creating, setCreating] = useState(false)
  const classes = useResource(`classes:${view}`, () => classesApi.list(view === 'archived'))
  useLive(['members', 'assignments'], () => void classes.reload())
  const navigate = useNavigate()
  const { toast } = useToast()

  async function create(draft: ClassDraft) {
    const room = await classesApi.create(draft)
    toast(`${room.name} is ready!`, { body: 'Share the invite link to bring students in.' })
    navigate(`/classes/${room.id}/invite`)
  }

  const items = classes.data?.items ?? []
  return (
    <Page className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="font-display text-4xl font-semibold tracking-tight">Your classes</h1>
          <p className="mt-1 text-muted-foreground">Invite students, sort them into groups, share what they'll learn.</p>
        </div>
        <Segmented
          label="Which classes"
          value={view}
          onChange={setView}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived', icon: <Archive weight="bold" className="size-4" /> },
          ]}
        />
        <Button size="lg" onClick={() => setCreating(true)}>
          <Plus weight="bold" className="size-5" />
          New class
        </Button>
      </div>

      {classes.error && <Alert className="mt-6">{classes.error}</Alert>}

      <div className="mt-8">
        {classes.loading && !classes.data ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-48 rounded-[1.75rem]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            art={<EmptyArt Icon={ChalkboardTeacher} />}
            title={view === 'active' ? 'Your first class starts here' : 'Nothing archived'}
            body={
              view === 'active'
                ? "Create a class and you'll get a link and a code to share with your students."
                : 'Classes you archive wait here, with their results kept safe.'
            }
            action={
              view === 'active' && (
                <Button size="lg" onClick={() => setCreating(true)}>
                  <Plus weight="bold" className="size-5" />
                  Create a class
                </Button>
              )
            }
          />
        ) : (
          <motion.ul
            key={view}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            variants={stagger(0.06)}
            initial="hidden"
            animate="shown"
          >
            {items.map((room) => (
              <ClassCard key={room.id} room={room} />
            ))}
          </motion.ul>
        )}
      </div>

      <ClassFormDialog open={creating} onClose={() => setCreating(false)} onSave={create} />
    </Page>
  )
}
