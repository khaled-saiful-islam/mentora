/**
 * Cheers from home (§28.3.3): a parent picks a sticker and a line, and their
 * child's buddy acts it out on the child's screen. Preset only, so a child
 * only ever sees words chosen with care.
 */
import { motion } from 'motion/react'
import { HandsClapping } from '@phosphor-icons/react'
import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { profileOf } from '@/features/buddies/profiles'
import { useResource } from '@/hooks/useResource'
import { pop, stagger } from '@/motion'
import { helpAtHomeApi } from '../api'

export function CheerButton({ childId, first, buddy, className }: { childId: string; first: string; buddy: string | null; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? 'inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-kind-family shadow-sm hover:brightness-95'}
      >
        <HandsClapping weight="fill" className="size-4" aria-hidden />
        Cheer {first} on
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Cheer ${first} on`} description={`${profileOf(buddy).name} will act it out on ${first}'s screen.`}>
        {open && <Picker childId={childId} first={first} buddy={buddy} onSent={() => setOpen(false)} />}
      </Dialog>
    </>
  )
}

function Picker({ childId, first, buddy, onSent }: { childId: string; first: string; buddy: string | null; onSent: () => void }) {
  const { toast } = useToast()
  const options = useResource(`cheers:${childId}`, () => helpAtHomeApi.cheers(childId))
  const [sending, setSending] = useState<string | null>(null)

  async function send(key: string) {
    setSending(key)
    try {
      const sent = await helpAtHomeApi.cheer(childId, key)
      toast(`Sent! ${sent.sticker}`, { tone: 'success', body: `${profileOf(buddy).name} will tell ${first}: "${sent.line}"` })
      onSent()
    } catch (error) {
      toast('Could not send that cheer', { tone: 'error', body: errorMessage(error) })
    } finally {
      setSending(null)
    }
  }

  return (
    <motion.ul className="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3" variants={stagger(0.05)} initial="hidden" animate="shown" aria-busy={sending !== null}>
      {(options.data?.items ?? []).map((cheer) => (
        <motion.li key={cheer.key} variants={pop}>
          <button
            type="button"
            disabled={sending !== null}
            onClick={() => void send(cheer.key)}
            className="flex h-full w-full flex-col items-center gap-1.5 rounded-3xl border-2 border-border bg-surface p-4 text-center transition-colors hover:border-hover-border focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:opacity-60"
          >
            <span className="text-4xl leading-none" aria-hidden>
              {cheer.sticker}
            </span>
            <span className="break-words font-semibold">{cheer.line}</span>
          </button>
        </motion.li>
      ))}
    </motion.ul>
  )
}
