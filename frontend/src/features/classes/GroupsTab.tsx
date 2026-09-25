import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { PencilSimple, Plus, Trash, UsersFour } from '@phosphor-icons/react'
import { Alert, Button, Card, Field, Input, Skeleton } from '@/components/ui'
import { Avatar } from '@/components/ui/Avatar'
import { Confirm } from '@/components/ui/Confirm'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { useResource } from '@/hooks/useResource'
import { rise, spring, stagger } from '@/motion'
import { lookOf, THEME_KEYS, THEMES, type ThemeKey } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { classesApi, type Group, type Member } from './api'
import { EmptyArt } from './EmptyArt'
import { useLive } from '@/lib/bus'

/** Groups inside a class — a student can be in as many as the teacher likes. */
export function GroupsTab({ classId, onChange }: { classId: string; onChange: () => void }) {
  const groups = useResource(`groups:${classId}`, () => classesApi.groups(classId))
  const students = useResource(`members:${classId}:approved:all`, () => classesApi.members(classId, { status: 'approved' }))
  useLive(['members'], (m) => m.class_id === classId && void students.reload())
  const [editing, setEditing] = useState<Group | 'new' | null>(null)
  const [picking, setPicking] = useState<Group | null>(null)
  const [deleting, setDeleting] = useState<Group | null>(null)
  const { toast } = useToast()
  const everyone = students.data?.items ?? []
  const byId = new Map(everyone.map((m) => [m.student_id, m]))

  async function remove(group: Group) {
    setDeleting(null)
    await classesApi.deleteGroup(classId, group.id)
    toast(`${group.name} deleted`, { tone: 'info' })
    await groups.reload()
    onChange()
  }

  const items = groups.data?.items ?? []
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="font-bold text-muted-foreground">Share work with a whole class, or just a group.</p>
        <Button onClick={() => setEditing('new')}>
          <Plus weight="bold" className="size-5" />
          New group
        </Button>
      </div>
      {groups.error && <Alert>{groups.error}</Alert>}
      {groups.loading && !groups.data ? (
        <Skeleton className="h-40 rounded-[1.5rem]" />
      ) : items.length === 0 ? (
        <EmptyState
          art={<EmptyArt Icon={UsersFour} tone="from-sky-100 to-grape-100" />}
          title="No groups yet"
          body="Make groups like “Reading Club” or “Needs extra practice”, then share activities with just them."
          action={<Button onClick={() => setEditing('new')}><Plus weight="bold" className="size-5" />Make a group</Button>}
        />
      ) : (
        <motion.ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" variants={stagger(0.06)} initial="hidden" animate="shown">
          <AnimatePresence>
            {items.map((group) => {
              const look = lookOf(group.colour)
              const members = group.member_ids.map((id) => byId.get(id)).filter(Boolean) as Member[]
              return (
                <motion.li key={group.id} variants={rise} layout exit={{ opacity: 0, scale: 0.9 }}>
                  <Card className="overflow-hidden">
                    <div className={cn('flex items-center gap-2 px-5 py-4', look.hero, look.onHero)}>
                      <UsersFour weight="fill" className="size-6" />
                      <p className="min-w-0 flex-1 break-words font-display text-xl font-semibold">{group.name}</p>
                      <button type="button" aria-label={`Rename ${group.name}`} onClick={() => setEditing(group)} className="grid size-8 place-items-center rounded-full hover:bg-white/20">
                        <PencilSimple weight="bold" className="size-4" />
                      </button>
                      <button type="button" aria-label={`Delete ${group.name}`} onClick={() => setDeleting(group)} className="grid size-8 place-items-center rounded-full hover:bg-white/20">
                        <Trash weight="bold" className="size-4" />
                      </button>
                    </div>
                    <div className="p-5">
                      <div className="flex -space-x-2">
                        {members.slice(0, 6).map((m) => (
                          <Avatar key={m.student_id} name={m.name} seed={m.student_id} className="size-9 ring-2 ring-surface" />
                        ))}
                        {members.length > 6 && (
                          <span className="grid size-9 place-items-center rounded-full bg-muted text-xs font-bold ring-2 ring-surface">+{members.length - 6}</span>
                        )}
                      </div>
                      <p className="mt-3 text-sm font-bold text-muted-foreground">
                        {members.length} {members.length === 1 ? 'student' : 'students'}
                      </p>
                      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setPicking(group)} disabled={everyone.length === 0}>
                        Choose students
                      </Button>
                    </div>
                  </Card>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </motion.ul>
      )}

      <GroupDialog classId={classId} group={editing} onClose={() => setEditing(null)} onSaved={async () => { await groups.reload(); onChange() }} />
      <MembersDialog classId={classId} group={picking} students={everyone} onClose={() => setPicking(null)} onSaved={() => void groups.reload()} />
      {deleting && (
        <Confirm
          title={`Delete ${deleting.name}?`}
          body="The group goes; the students stay in the class. Work already shared with this group stays with them."
          onConfirm={() => void remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

function GroupDialog({ classId, group, onClose, onSaved }: { classId: string; group: Group | 'new' | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const editing = group && group !== 'new' ? group : null
  const [name, setName] = useState('')
  const [colour, setColour] = useState<ThemeKey>('sky')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastOpened, setLastOpened] = useState<Group | 'new' | null>(null)
  if (group !== lastOpened) {
    setLastOpened(group)
    setName(editing?.name ?? '')
    setColour(editing?.colour ?? 'sky')
    setError(null)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      if (editing) await classesApi.updateGroup(classId, editing.id, { name, colour })
      else await classesApi.createGroup(classId, name, colour)
      await onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={group !== null} onClose={onClose} title={editing ? 'Edit group' : 'New group'} size="sm">
      <form onSubmit={save} className="space-y-5">
        <Field label="Group name" htmlFor="group-name">
          <Input id="group-name" required maxLength={80} autoFocus placeholder="e.g. Reading Club" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Group colour">
          {THEME_KEYS.map((key) => (
            <motion.button key={key} type="button" role="radio" aria-checked={colour === key} aria-label={THEMES[key].label} onClick={() => setColour(key)} animate={{ scale: colour === key ? 1.15 : 1 }} transition={spring.bouncy} className={cn('size-9 rounded-full', THEMES[key].hero, colour === key && 'ring-4 ring-primary/40 ring-offset-2 ring-offset-surface')} />
          ))}
        </div>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>{editing ? 'Save' : 'Create'}</Button>
        </div>
      </form>
    </Dialog>
  )
}

function MembersDialog({ classId, group, students, onClose, onSaved }: { classId: string; group: Group | null; students: Member[]; onClose: () => void; onSaved: () => void }) {
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastOpened, setLastOpened] = useState<Group | null>(null)
  if (group !== lastOpened) {
    setLastOpened(group)
    setChosen(new Set(group?.member_ids ?? []))
    setError(null)
  }

  async function save() {
    if (!group) return
    setBusy(true)
    try {
      await classesApi.setGroupMembers(classId, group.id, Array.from(chosen))
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={group !== null}
      onClose={onClose}
      title={group ? `Who's in ${group.name}?` : ''}
      description={`${chosen.size} chosen`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} loading={busy}>Save</Button>
        </>
      }
    >
      <ul className="space-y-1">
        {students.map((m) => {
          const on = chosen.has(m.student_id)
          return (
            <li key={m.student_id}>
              <label className={cn('flex cursor-pointer items-center gap-3 rounded-2xl p-2.5 transition-colors', on ? 'bg-grape-50 dark:bg-grape-900/30' : 'hover:bg-hover')}>
                <input type="checkbox" checked={on} onChange={() => setChosen((all) => { const next = new Set(all); if (next.has(m.student_id)) next.delete(m.student_id); else next.add(m.student_id); return next })} className="size-5 accent-[hsl(var(--primary))]" />
                <Avatar name={m.name} seed={m.student_id} className="size-9" />
                <span className="font-bold">{m.name}</span>
                <span className="text-sm text-muted-foreground">{m.username && `@${m.username}`}</span>
              </label>
            </li>
          )
        })}
      </ul>
      {error && <Alert className="mt-3">{error}</Alert>}
    </Dialog>
  )
}
