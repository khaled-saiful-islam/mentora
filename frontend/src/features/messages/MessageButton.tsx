/**
 * "Message the teacher" on a parent's view of a child's class, "Message the
 * family" on a teacher's class list. Given the contacts that fit this spot;
 * nothing shows when there are none — no one to write to yet.
 */
import { useState } from 'react'
import { ChatCircleText } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { Dialog } from '@/components/ui/Dialog'
import { useResource } from '@/hooks/useResource'
import { can, type User } from '@/lib/user'
import { messagesApi, type Contact } from './api'
import { useOpenThread } from './useOpenThread'

/** Everyone this person may write to — one request for a whole page. */
export function useContacts(user: User | null): Contact[] {
  const allowed = user !== null && can(user, 'parent_teacher_messages')
  const inbox = useResource(allowed ? `messages-contacts:${user.id}` : null, () => messagesApi.inbox())
  return inbox.data?.contacts ?? []
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
