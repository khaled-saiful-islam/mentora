/**
 * "Message the teacher" on a parent's view of a child's class, "Message the
 * family" on a teacher's class list — and, for a student with no family
 * connected yet, "Ask to connect a parent", since a teacher can only write
 * to a family the child has linked.
 */
import { useState } from 'react'
import { ChatCircleText, UserCirclePlus } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { useResource } from '@/hooks/useResource'
import { can, type User } from '@/lib/user'
import { messagesApi, type Contact, type Waiting } from './api'
import { useOpenThread } from './useOpenThread'

/** Everyone this person may write to, and — for a teacher — the students
 *  whose family is not connected yet. One request for a whole page. */
export function usePeople(user: User | null): { contacts: Contact[]; waiting: Waiting[] } {
  const allowed = user !== null && can(user, 'parent_teacher_messages')
  const inbox = useResource(allowed ? `messages-people:${user.id}` : null, () => messagesApi.inbox())
  return { contacts: inbox.data?.contacts ?? [], waiting: inbox.data?.waiting ?? [] }
}

export function MessageButton({ contacts, label, compact = false }: { contacts: Contact[]; label: string; compact?: boolean }) {
  const { open, opening } = useOpenThread()
  const [choosing, setChoosing] = useState(false)
  if (contacts.length === 0) return null

  const go = () => (contacts.length === 1 ? void open(contacts[0]) : setChoosing(true))
  return (
    <>
      {compact ? (
        <Button variant="ghost" size="icon" aria-label={label} title={label} onClick={go} disabled={opening !== null}>
          <ChatCircleText weight="bold" className="size-5" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={go} disabled={opening !== null}>
          <ChatCircleText weight="bold" className="size-4" aria-hidden />
          {label}
        </Button>
      )}
      {choosing && (
        <Dialog open onClose={() => setChoosing(false)} title={label} description="Who would you like to write to?" size="sm">
          <ul className="space-y-2">
            {contacts.map((c) => (
              <li key={c.person_id}>
                <Button variant="outline" className="w-full justify-start" onClick={() => void open(c).then(() => setChoosing(false))}>
                  <span className="break-words">
                    {c.person_name} ({c.relation})
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </>
  )
}

/** Ask a student to send a parent their invitation. */
export function useAskFamily(): { ask: (student: Pick<Waiting, 'student_id' | 'student_name'>) => Promise<void>; asking: string | null } {
  const { toast } = useToast()
  const [asking, setAsking] = useState<string | null>(null)
  async function ask(student: Pick<Waiting, 'student_id' | 'student_name'>) {
    setAsking(student.student_id)
    try {
      const { sent } = await messagesApi.askFamily(student.student_id)
      toast(sent ? `Asked ${student.student_name} to connect a parent` : `You already asked ${student.student_name} today`, {
        tone: sent ? 'success' : 'info',
        body: sent ? "They'll see it in their bell, with their invitation one tap away." : 'Their family can connect from the invitation any time.',
      })
    } catch (error) {
      toast("Couldn't ask", { tone: 'error', body: errorMessage(error) })
    } finally {
      setAsking(null)
    }
  }
  return { ask, asking }
}

export function AskFamilyButton({ student }: { student: Pick<Waiting, 'student_id' | 'student_name'> }) {
  const { ask, asking } = useAskFamily()
  const label = `Ask ${student.student_name} to connect a parent`
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} onClick={() => void ask(student)} disabled={asking !== null}>
      <UserCirclePlus weight="bold" className="size-5" />
    </Button>
  )
}
