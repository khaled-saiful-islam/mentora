import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Key, MagnifyingGlass, Student, UserMinus, UsersFour } from '@phosphor-icons/react'
import { Alert, Button, Card, Chip, Input, Skeleton } from '@/components/ui'
import { Avatar } from '@/components/ui/Avatar'
import { Confirm } from '@/components/ui/Confirm'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { PasswordReveal } from '@/features/admin/UserDialogs'
import { errorMessage } from '@/features/auth/errors'
import { useResource } from '@/hooks/useResource'
import { rise, stagger } from '@/motion'
import { lookOf } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { classesApi, type Group, type Member } from './api'
import { EmptyArt } from './EmptyArt'
import { useLive } from '@/lib/bus'

type View = 'approved' | 'past'

export function StudentsTab({ classId, onChange }: { classId: string; onChange: () => void }) {
  const [view, setView] = useState<View>('approved')
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [removing, setRemoving] = useState<Member | null>(null)
  const [resetting, setResetting] = useState<Member | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const members = useResource(`members:${classId}:${view}:${q}`, async () => {
    if (view === 'approved') return classesApi.members(classId, { status: 'approved', q })
    const [revoked, left] = await Promise.all([
      classesApi.members(classId, { status: 'revoked', q }),
      classesApi.members(classId, { status: 'left', q }),
    ])
    return { ...revoked, items: [...revoked.items, ...left.items], total: revoked.total + left.total }
  })
  const groups = useResource(`groups:${classId}`, () => classesApi.groups(classId))
  useLive(['members'], (m) => m.class_id === classId && void members.reload())
  const groupsOf = useMemo(() => indexGroups(groups.data?.items ?? []), [groups.data])

  async function remove(member: Member) {
    setRemoving(null)
    try {
      await classesApi.revoke(classId, member.membership_id)
      toast(`${member.name} was removed`, { tone: 'info', body: 'Their results are kept.' })
      await Promise.all([members.reload(), groups.reload()])
      onChange()
    } catch (error) {
      toast('Could not remove', { tone: 'error', body: errorMessage(error) })
    }
  }

  async function addToGroup(group: Group) {
    const ids = Array.from(new Set([...group.member_ids, ...selected]))
    try {
      await classesApi.setGroupMembers(classId, group.id, ids)
      toast(`Added ${selected.size} to ${group.name}`)
      setSelected(new Set())
      await groups.reload()
      onChange()
    } catch (error) {
      toast('Could not add them', { tone: 'error', body: errorMessage(error) })
    }
  }

  const items = members.data?.items ?? []
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <MagnifyingGlass weight="bold" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search students" placeholder="Search by name or username" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-11" />
        </div>
        <Segmented label="Which students" value={view} onChange={(v) => { setView(v); setSelected(new Set()) }} options={[{ value: 'approved', label: 'In class' }, { value: 'past', label: 'Removed or left' }]} />
      </div>

      <AnimatePresence>
        {selected.size > 0 && (groups.data?.items.length ?? 0) > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-grape-200 bg-grape-50 p-3 dark:border-grape-700 dark:bg-grape-900/30">
            <span className="font-bold">{selected.size} selected — add to:</span>
            {groups.data!.items.map((group) => (
              <button key={group.id} type="button" onClick={() => void addToGroup(group)} className={cn('rounded-full px-3 py-1 text-sm font-bold transition-transform hover:scale-105', lookOf(group.colour).soft)}>
                {group.name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {members.error && <Alert>{members.error}</Alert>}
      {members.loading && !members.data ? (
        <Skeleton className="h-48 rounded-[1.5rem]" />
      ) : items.length === 0 ? (
        <EmptyState
          art={<EmptyArt Icon={Student} />}
          title={q ? 'No one by that name' : view === 'approved' ? 'No students yet' : 'Nobody has left'}
          body={view === 'approved' && !q ? 'Share your invite and let students in from Requests.' : undefined}
          action={view === 'approved' && !q && <Link to={`/classes/${classId}/invite`}><Button variant="outline">Share the invite</Button></Link>}
        />
      ) : (
        <Card className="overflow-hidden">
          <motion.ul className="divide-y divide-border" variants={stagger(0.03)} initial="hidden" animate="shown" key={`${view}:${q}`}>
            {items.map((member) => (
              <motion.li key={member.membership_id} variants={rise} className="flex items-center gap-3 px-4 py-3">
                {view === 'approved' && (
                  <input
                    type="checkbox"
                    aria-label={`Select ${member.name}`}
                    checked={selected.has(member.student_id)}
                    onChange={() => setSelected((all) => toggle(all, member.student_id))}
                    className="size-5 accent-[hsl(var(--primary))]"
                  />
                )}
                <Avatar name={member.name} seed={member.student_id} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{member.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[member.username && `@${member.username}`, member.grade_label].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                  {(groupsOf.get(member.student_id) ?? []).map((group) => (
                    <span key={group.id} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold', lookOf(group.colour).soft)}>
                      <UsersFour weight="fill" className="size-3" />
                      {group.name}
                    </span>
                  ))}
                  {view === 'past' && <Chip>{member.status === 'left' ? 'left' : 'removed'}</Chip>}
                </div>
                {view === 'approved' && (
                  <>
                    <Button variant="ghost" size="icon" aria-label={`Reset ${member.name}'s password`} title="Reset password" onClick={() => setResetting(member)}>
                      <Key weight="bold" className="size-5" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${member.name}`} onClick={() => setRemoving(member)}>
                      <UserMinus weight="bold" className="size-5" />
                    </Button>
                  </>
                )}
              </motion.li>
            ))}
          </motion.ul>
        </Card>
      )}

      {resetting && <ResetStudent classId={classId} member={resetting} onClose={() => setResetting(null)} />}

      {removing && (
        <Confirm
          title={`Remove ${removing.name}?`}
          body="They'll leave this class and all its groups, and won't get new work from it. Everything they've already done is kept."
          confirmLabel="Remove"
          onConfirm={() => void remove(removing)}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  )
}

/** A student forgot their password: make a new one, shown once to pass on. */
function ResetStudent({ classId, member, onClose }: { classId: string; member: Member; onClose: () => void }) {
  const [result, setResult] = useState<{ sign_in_name: string; password: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function reset() {
    setBusy(true)
    setError(null)
    try {
      setResult(await classesApi.resetPassword(classId, member.membership_id))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Reset ${member.name}'s password?`}
      description="Their old password stops working. You'll get a new one to give them."
      size="sm"
      footer={result ? <Button onClick={onClose}>Done</Button> : (
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void reset()} loading={busy}>Make a new password</Button>
        </>
      )}
    >
      {error && <Alert>{error}</Alert>}
      {result && <PasswordReveal result={result} />}
    </Dialog>
  )
}

function toggle(all: Set<string>, id: string): Set<string> {
  const next = new Set(all)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

function indexGroups(groups: Group[]): Map<string, Group[]> {
  const index = new Map<string, Group[]>()
  for (const group of groups) {
    for (const id of group.member_ids) index.set(id, [...(index.get(id) ?? []), group])
  }
  return index
}
