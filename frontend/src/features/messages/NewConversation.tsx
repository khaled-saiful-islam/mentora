/**
 * Who this person can write to, by child: a parent sees each child's
 * teachers, a teacher each student's family. A search narrows a long list.
 */
import { useMemo, useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { Input, Spinner } from '@/components/ui'
import { Avatar } from '@/components/ui/Avatar'
import { Dialog } from '@/components/ui/Dialog'
import type { Contact } from './api'
import { useOpenThread } from './useOpenThread'

const SEARCH_FROM = 6

export function NewConversation({ contacts, onClose }: { contacts: Contact[]; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const { open, opening } = useOpenThread()
  const groups = useMemo(() => byChild(matching(contacts, query)), [contacts, query])

  return (
    <Dialog open onClose={onClose} title="New message" description="Pick who to write to." size="md">
      {contacts.length >= SEARCH_FROM && (
        <label className="relative mb-4 block">
          <span className="sr-only">Search</span>
          <MagnifyingGlass weight="bold" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or class" className="pl-10" />
        </label>
      )}
      {groups.length === 0 && <p className="text-muted-foreground">No one by that name.</p>}
      <div className="space-y-4">
        {groups.map(([child, people]) => (
          <section key={child}>
            <h3 className="text-sm font-bold text-muted-foreground">About {child}</h3>
            <ul className="mt-2 space-y-2">
              {people.map((c) => {
                const busy = opening === `${c.student_id}:${c.person_id}`
                return (
                  <li key={`${c.student_id}:${c.person_id}`}>
                    <button
                      type="button"
                      disabled={opening !== null}
                      onClick={() => void open(c).then(onClose)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left hover:-translate-y-0.5 hover:border-hover-border hover:bg-hover disabled:opacity-60"
                    >
                      <Avatar name={c.person_name} seed={c.person_id} className="size-10" />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-bold">{c.person_name}</span>
                        <span className="block break-words text-sm text-muted-foreground">{[c.relation, ...c.class_names].join(' · ')}</span>
                      </span>
                      {busy && <Spinner className="size-5" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  )
}

function matching(contacts: Contact[], query: string): Contact[] {
  const q = query.trim().toLowerCase()
  if (!q) return contacts
  return contacts.filter((c) => [c.person_name, c.student_name, c.relation, ...c.class_names].some((s) => s.toLowerCase().includes(q)))
}

function byChild(contacts: Contact[]): [string, Contact[]][] {
  const groups = new Map<string, Contact[]>()
  for (const c of contacts) groups.set(c.student_name, [...(groups.get(c.student_name) ?? []), c])
  return [...groups.entries()]
}
