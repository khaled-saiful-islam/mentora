/** Open (or make) the conversation with someone about a child, then go to it. */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { messagesApi, type Contact } from './api'

export function useOpenThread(): { open: (contact: Contact, draft?: string) => Promise<void>; opening: string | null } {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [opening, setOpening] = useState<string | null>(null)

  async function open(contact: Contact, draft?: string) {
    const key = `${contact.student_id}:${contact.person_id}`
    setOpening(key)
    try {
      const thread = await messagesApi.open(contact.student_id, contact.person_id)
      navigate(`/messages/${thread.id}`, { state: draft ? { draft } : undefined })
    } catch (error) {
      toast("Couldn't open the conversation", { tone: 'error', body: errorMessage(error) })
    } finally {
      setOpening(null)
    }
  }

  return { open, opening }
}
