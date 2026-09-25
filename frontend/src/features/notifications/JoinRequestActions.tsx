import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { classesApi } from '@/features/classes/api'
import { pop } from '@/motion'
import { emit } from '@/lib/bus'
import type { Notification } from './api'
import { useNotifications } from './NotificationsProvider'

const RESOLVED: Record<string, { label: string; tone: string }> = {
  approved: { label: 'Let in', tone: 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100' },
  rejected: { label: 'Declined', tone: 'bg-muted text-muted-foreground' },
  withdrawn: { label: 'Withdrawn', tone: 'bg-muted text-muted-foreground' },
}

/** Approve or decline a join request without leaving the bell. */
export function JoinRequestActions({ note }: { note: Notification }) {
  const { refresh } = useNotifications()
  const { toast } = useToast()
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const resolution = note.payload.resolution as string | undefined
  const classId = String(note.payload.class_id ?? '')
  const membershipId = String(note.payload.membership_id ?? '')
  const name = String(note.payload.student_name ?? 'the student')

  async function decide(action: 'approve' | 'reject') {
    setBusy(action)
    try {
      await (action === 'approve' ? classesApi.approve : classesApi.reject)(classId, membershipId)
      toast(action === 'approve' ? `${name} is in!` : `Declined ${name}`, {
        tone: action === 'approve' ? 'success' : 'info',
      })
    } catch (error) {
      toast('That did not work', { tone: 'error', body: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(null)
      emit('class-changed', classId)
      void refresh()
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {resolution ? (
        <motion.span
          key="done"
          variants={pop}
          initial="hidden"
          animate="shown"
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${RESOLVED[resolution]?.tone ?? ''}`}
        >
          {resolution === 'approved' && <Check weight="bold" className="size-3.5" />}
          {RESOLVED[resolution]?.label ?? resolution}
        </motion.span>
      ) : (
        <motion.div key="ask" className="flex gap-2" exit={{ opacity: 0, scale: 0.9 }}>
          <Button size="sm" loading={busy === 'approve'} disabled={busy !== null} onClick={() => void decide('approve')}>
            {busy !== 'approve' && <Check weight="bold" className="size-4" />}
            Let in
          </Button>
          <Button size="sm" variant="outline" loading={busy === 'reject'} disabled={busy !== null} onClick={() => void decide('reject')}>
            {busy !== 'reject' && <X weight="bold" className="size-4" />}
            Decline
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
