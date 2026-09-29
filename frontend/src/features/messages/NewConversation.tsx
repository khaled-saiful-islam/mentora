/**
 * Who this person can write to, by child: a parent sees each child's
 * teachers, a teacher each student's family. A search narrows a long list.
 *
 * A teacher also sees the students whose family has not connected yet, with
 * a way to ask them to — a family has to be linked by the child before a
 * teacher can write to it.
 */
import { useMemo, useState } from 'react'
import { MagnifyingGlass, UserCirclePlus } from '@phosphor-icons/react'
import { Button, Input, Spinner } from '@/components/ui'
import { Avatar } from '@/components/ui/Avatar'
import { Dialog } from '@/components/ui/Dialog'
import type { Contact, Waiting } from './api'
import { useAskFamily } from './MessageButton'
import { useOpenThread } from './useOpenThread'

const SEARCH_FROM = 6

export function NewConversation({ contacts, waiting = [], onClose }: { contacts: Contact[]; waiting?: Waiting[]; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const { open, opening } = useOpenThread()
  const groups = useMemo(() => byChild(matching(contacts, query)), [contacts, query])
  const unlinked = useMemo(() => matchingWaiting(waiting, query), [waiting, query])
  const description = contacts.length ? 'Pick who to write to.' : "None of your students' families are connected yet."

  return (
    <Dialog open onClose={onClose} title="New message" description={description} size="md">
      {contacts.length + waiting.length >= SEARCH_FROM && (
        <label className="relative mb-4 block">
          <span className="sr-only">Search</span>
          <MagnifyingGlass weight="bold" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or class" className="pl-10" />
        </label>
      )}
      {query.trim() && groups.length === 0 && unlinked.length === 0 && <p className="text-muted-foreground">No one by that name.</p>}
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
      {unlinked.length > 0 && <NotConnected students={unlinked} />}
    </Dialog>
  )
}

function NotConnected({ students }: { students: Waiting[] }) {
  const { ask, asking } = useAskFamily()
  return (
    <section className="mt-6">
      <h3 className="text-sm font-bold text-muted-foreground">No family connected yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        A parent connects with their child's invitation. Ask the student to send it — they'll get a note in their bell.
      </p>
      <ul className="mt-2 space-y-2">
        {students.map((s) => (
          <li key={s.student_id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border p-3">
            <Avatar name={s.student_name} seed={s.student_id} className="size-10" />
            <span className="min-w-[min(100%,10rem)] flex-1">
              <span className="block break-words font-bold">{s.student_name}</span>
              <span className="block break-words text-sm text-muted-foreground">{s.class_names.join(' · ')}</span>
            </span>
            <Button variant="outline" size="sm" disabled={asking !== null} onClick={() => void ask(s)}>
              {asking === s.student_id ? <Spinner className="size-4" /> : <UserCirclePlus weight="bold" className="size-4" aria-hidden />}
              Ask to connect
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function matchingWaiting(waiting: Waiting[], query: string): Waiting[] {
  const q = query.trim().toLowerCase()
  return q ? waiting.filter((w) => [w.student_name, ...w.class_names].some((s) => s.toLowerCase().includes(q))) : waiting
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
