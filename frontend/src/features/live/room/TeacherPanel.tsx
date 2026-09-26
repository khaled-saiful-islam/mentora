/**
 * The teacher's side of a live lesson, under the stage: who is here (and a
 * way to take someone out), the hands in the queue, and everything said so
 * far, as it is said.
 */
import { HandWaving, SignOut, UsersThree, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { roomApi, type RosterEntry } from './api'
import type { Said } from './useRoom'

export function TeacherPanel({
  id,
  roster,
  hands,
  said,
}: {
  id: string
  roster: RosterEntry[]
  hands: { student_id: string; name: string }[]
  said: Said[]
}) {
  const here = roster.filter((r) => r.here).length
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold">
            <UsersThree weight="bold" className="size-5 text-kind-live" aria-hidden />
            In the room · {here} of {roster.length}
          </h2>
          <ul className="space-y-1.5">
            {roster.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted/60">
                <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', r.here ? 'bg-mint-400' : 'bg-muted-foreground/30')} />
                <span className="min-w-0 flex-1 break-words font-semibold">{r.name}</span>
                <span className="text-xs text-muted-foreground">{r.here ? 'here' : 'away'}</span>
                <button
                  type="button"
                  aria-label={`Remove ${r.name} from the lesson`}
                  onClick={() => {
                    if (window.confirm(`Remove ${r.name} from this lesson? They won't be able to come back in.`)) void roomApi.remove(id, r.id)
                  }}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <SignOut weight="bold" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold">
            <HandWaving weight="bold" className="size-5 text-kind-live" aria-hidden />
            Hands up · {hands.length}
          </h2>
          {hands.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hands up right now.</p>
          ) : (
            <ol className="space-y-1.5">
              <AnimatePresence initial={false}>
                {hands.map((h, i) => (
                  <motion.li
                    key={h.student_id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="flex items-center gap-2 rounded-xl bg-sun-100 px-2 py-1.5 text-grape-900"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sun-400 text-xs font-bold">{i + 1}</span>
                    <span className="min-w-0 flex-1 break-words font-semibold">{h.name}</span>
                    <button
                      type="button"
                      aria-label={`Dismiss ${h.name}'s hand`}
                      onClick={() => void roomApi.dismiss(id, h.student_id)}
                      className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/60"
                    >
                      <X weight="bold" className="size-4" />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          )}
        </Card>
      </div>
      <LiveTranscript said={said} />
    </div>
  )
}

function LiveTranscript({ said }: { said: Said[] }) {
  // Follow the newest line inside the box only — never move the page under
  // the teacher's feet.
  const box = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const el = box.current
    if (el) el.scrollTop = el.scrollHeight
  }, [said.length])
  return (
    <Card className="p-4">
      <h2 className="mb-2 font-display text-lg font-semibold">Transcript, live</h2>
      <ol ref={box} className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
        {said.map((s) => (
          <li
            key={s.id}
            className={cn('break-words rounded-xl px-3 py-1.5 text-sm', s.speaker === 'student' ? 'bg-sun-100 text-grape-900' : 'bg-muted/60')}
          >
            <span className="font-bold">{s.speaker === 'student' ? s.name ?? 'A student' : 'Astra'}: </span>
            {s.text}
          </li>
        ))}
      </ol>
    </Card>
  )
}
