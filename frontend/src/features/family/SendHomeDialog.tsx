/**
 * Send a set home (§20.4): to which of your children, and by when if you
 * like. Sending again moves them to the latest version and the new date.
 */
import { Check, HeartStraight, House } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Alert, Button, ButtonLink, Field, Skeleton } from '@/components/ui'
import { DateTimeField, localNow } from '@/components/ui/DateTimeField'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { BuddyAvatar } from '@/features/buddies/BuddyAvatar'
import { useResource } from '@/hooks/useResource'
import { cn } from '@/lib/utils'
import { celebrate, spring, useCalmMotion } from '@/motion'
import { familyApi, sendHomeApi, type SentHome } from './api'

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export function SendHomeDialog({ open, set, onClose }: { open: boolean; set: { id: string; title: string }; onClose: () => void }) {
  const children = useResource(open ? 'send-home:children' : null, () => familyApi.children())
  const sent = useResource(open ? `send-home:${set.id}` : null, () => sendHomeApi.of(set.id))
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const calm = useCalmMotion()
  const kids = children.data?.items ?? []
  const already = new Map<string, SentHome>((sent.data?.items ?? []).map((s) => [s.student_id, s]))

  useEffect(() => {
    if (!open) return
    setError(null)
    setDue('')
    setChosen(kids.length === 1 ? new Set([kids[0].id]) : new Set())
  }, [open, kids.length])

  function toggle(id: string) {
    setChosen((all) => {
      const next = new Set(all)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function send() {
    setBusy(true)
    setError(null)
    try {
      await sendHomeApi.send(set.id, [...chosen], due ? new Date(due).toISOString() : null)
      const names = kids.filter((k) => chosen.has(k.id)).map((k) => k.first_name)
      celebrate({ calm, power: 0.6 })
      toast(`Sent to ${names.join(' and ')}!`, { tone: 'success', body: 'They’ll see it on their home, with a note in their bell.' })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function takeBack(share: SentHome) {
    try {
      await sendHomeApi.takeBack(share.id)
      toast(`Taken back from ${share.first_name}`, { tone: 'info' })
      void sent.reload()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const names = kids.filter((k) => chosen.has(k.id)).map((k) => k.first_name)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Send “${set.title}” home`}
      description="Your child finds it on their home, with a note in their bell. You’ll hear how it went."
      footer={
        kids.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => void send()} loading={busy} disabled={chosen.size === 0} className="h-auto min-h-11 whitespace-normal bg-kind-family-vivid py-2 text-white">
              {!busy && <HeartStraight weight="fill" className="size-4" aria-hidden />}
              {names.length ? `Send to ${names.join(' and ')}` : 'Choose who to send it to'}
            </Button>
          </div>
        )
      }
    >
      {!children.data ? (
        <Skeleton className="h-32 rounded-3xl" />
      ) : kids.length === 0 ? (
        <div className="space-y-3 text-center">
          <p className="text-muted-foreground">Connect to your child first — then you can send them what you make.</p>
          <ButtonLink to="/" variant="outline">
            <House weight="bold" className="size-4" aria-hidden /> Connect a child
          </ButtonLink>
        </div>
      ) : (
        <div className="space-y-5">
          <section aria-label="Who to send it to" className="space-y-2">
            {kids.map((kid) => {
              const on = chosen.has(kid.id)
              const has = already.get(kid.id)
              return (
                <div key={kid.id} className="flex flex-wrap items-center gap-2">
                  <motion.button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(kid.id)}
                    whileTap={{ scale: 0.97 }}
                    transition={spring.bouncy}
                    className={cn('flex min-w-[min(100%,16rem)] flex-1 items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors', on ? 'border-kind-family-vivid bg-kind-family-vivid/8' : 'border-border hover:border-hover-border')}
                  >
                    <BuddyAvatar buddy={kid.buddy} size={44} mood={on ? 'happy' : 'idle'} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-bold leading-snug">{kid.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {has ? `Already has it${has.due_at ? ` · due ${when(has.due_at)}` : ''}` : kid.grade_label ?? 'Not sent yet'}
                      </span>
                    </span>
                    <motion.span
                      animate={{ scale: on ? 1 : 0.6, opacity: on ? 1 : 0.3 }}
                      transition={spring.bouncy}
                      className={cn('grid size-7 shrink-0 place-items-center rounded-full', on ? 'bg-kind-family-vivid text-white' : 'border-2 border-border')}
                    >
                      {on && <Check weight="bold" className="size-4" aria-hidden />}
                    </motion.span>
                  </motion.button>
                  {has && (
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void takeBack(has)}>
                      Take back
                    </Button>
                  )}
                </div>
              )
            })}
          </section>
          <Field label="Due (optional)" htmlFor="send-home-due">
            <DateTimeField id="send-home-due" value={due} min={localNow()} onChange={setDue} placeholder="No due date" />
          </Field>
          {chosen.size > 0 && [...chosen].some((id) => already.has(id)) && (
            <p className="text-sm text-muted-foreground">Sending it again gives them your latest changes and the new due date.</p>
          )}
          {error && <Alert>{error}</Alert>}
        </div>
      )}
    </Dialog>
  )
}
