import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Confetti, UserCirclePlus, X } from '@phosphor-icons/react'
import { Alert, Button, Card, Skeleton } from '@/components/ui'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { useResource } from '@/hooks/useResource'
import { spring } from '@/motion'
import { timeAgo } from '@/lib/time'
import { classesApi, type Member } from './api'
import { EmptyArt } from './EmptyArt'
import { useLive } from '@/lib/bus'

/** Who is waiting to be let in — answer one by one, or everyone at once. */
export function RequestsTab({ classId, onChange }: { classId: string; onChange: () => void }) {
  const waiting = useResource(`requests:${classId}`, () => classesApi.members(classId, { status: 'pending' }))
  useLive(['members'], (m) => m.class_id === classId && void waiting.reload())
  const [busy, setBusy] = useState<string | null>(null)
  const { toast } = useToast()
  const items = waiting.data?.items ?? []

  async function decide(member: Member, action: 'approve' | 'reject') {
    setBusy(member.membership_id)
    try {
      await (action === 'approve' ? classesApi.approve : classesApi.reject)(classId, member.membership_id)
      waiting.setData((page) => ({ ...page!, items: page!.items.filter((m) => m.membership_id !== member.membership_id), total: page!.total - 1 }))
      toast(action === 'approve' ? `${member.name} is in!` : `Declined ${member.name}`, { tone: action === 'approve' ? 'success' : 'info' })
      onChange()
    } catch (error) {
      toast('That did not work', { tone: 'error', body: errorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  async function approveAll() {
    setBusy('all')
    try {
      const { approved } = await classesApi.approveAll(classId)
      toast(`${approved} ${approved === 1 ? 'student' : 'students'} let in!`)
      await waiting.reload()
      onChange()
    } finally {
      setBusy(null)
    }
  }

  if (waiting.error) return <Alert>{waiting.error}</Alert>
  if (waiting.loading && !waiting.data) return <Skeleton className="h-40 rounded-[1.5rem]" />
  if (items.length === 0) {
    return (
      <EmptyState
        art={<EmptyArt Icon={Confetti} tone="from-mint-100 to-sun-100" />}
        title="No one waiting"
        body="When a student uses your link or code, they'll pop up here for you to let in."
        action={
          <Link to={`/classes/${classId}/invite`}>
            <Button variant="outline">Share the invite</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold text-muted-foreground">
          {items.length} {items.length === 1 ? 'student is' : 'students are'} waiting
        </p>
        {items.length > 1 && (
          <Button onClick={() => void approveAll()} loading={busy === 'all'}>
            <Check weight="bold" className="size-5" />
            Let everyone in
          </Button>
        )}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {items.map((member) => (
            <motion.li
              key={member.membership_id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
              transition={spring.gentle}
            >
              <Card className="flex items-center gap-3 p-4">
                <Avatar name={member.name} seed={member.student_id} className="size-12" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{member.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[member.username && `@${member.username}`, member.grade_label, timeAgo(member.requested_at)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button size="icon" aria-label={`Let ${member.name} in`} disabled={busy !== null} onClick={() => void decide(member, 'approve')}>
                  <Check weight="bold" className="size-5" />
                </Button>
                <Button size="icon" variant="outline" aria-label={`Decline ${member.name}`} disabled={busy !== null} onClick={() => void decide(member, 'reject')}>
                  <X weight="bold" className="size-5" />
                </Button>
              </Card>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserCirclePlus weight="duotone" className="size-5" />
        Declining is quiet — the student isn't sent a message about it.
      </p>
    </div>
  )
}
