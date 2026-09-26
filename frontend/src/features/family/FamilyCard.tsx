/**
 * A child's family, in their settings: who is following along, and the
 * invitation to send a parent — a link, a code and a QR code. The child can
 * see everyone connected; only the parent can disconnect (§20.0).
 */
import { ArrowsClockwise, HeartStraight, LinkSimple, Lock, LockOpen } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Alert, Button, Card, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { CopyButton, QrPicture } from '@/features/classes/InviteTab'
import { useResource } from '@/hooks/useResource'
import { useLive } from '@/lib/bus'
import { cn } from '@/lib/utils'
import { pop, rise, stagger } from '@/motion'
import { familyApi, type FamilyInvite } from './api'

export function FamilyCard() {
  const family = useResource('my-family', () => familyApi.mine())
  useLive(['family'], () => void family.reload())
  const { toast } = useToast()
  const data = family.data

  async function change(run: () => Promise<FamilyInvite>, said: string) {
    try {
      const invite = await run()
      if (family.data) family.setData({ ...family.data, invite })
      toast(said)
    } catch (e) {
      toast('That did not work', { tone: 'error', body: errorMessage(e) })
    }
  }

  return (
    <Card className="mt-8 overflow-hidden">
      <div className="flex items-center gap-3 bg-gradient-to-br from-kind-family-vivid/15 to-transparent p-6 pb-4">
        <motion.span
          className="grid size-11 place-items-center rounded-2xl bg-kind-family-vivid text-white shadow-press"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.2 }}
        >
          <HeartStraight weight="fill" className="size-6" aria-hidden />
        </motion.span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold">My family</h2>
          <p className="text-sm text-muted-foreground">Invite your mum, dad or carer to follow how you're doing.</p>
        </div>
      </div>

      {family.error ? (
        <Alert className="m-6">{family.error}</Alert>
      ) : !data ? (
        <Skeleton className="m-6 h-40 rounded-3xl" />
      ) : (
        <div className="space-y-6 p-6 pt-2">
          {data.parents.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-foreground/85">Following along</h3>
              <motion.ul className="mt-2 flex flex-wrap gap-2" variants={stagger(0.06)} initial="hidden" animate="shown">
                {data.parents.map((parent) => (
                  <motion.li key={`${parent.name}-${parent.linked_at}`} variants={pop} className="inline-flex items-center gap-2 rounded-full bg-kind-family-vivid/10 px-3 py-1.5 text-sm font-bold">
                    <HeartStraight weight="fill" className="size-4 text-kind-family" aria-hidden />
                    <span className="break-words">
                      {parent.label} · {parent.name}
                    </span>
                  </motion.li>
                ))}
              </motion.ul>
            </section>
          )}

          <motion.section variants={rise} initial="hidden" animate="shown" className={cn('grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start', !data.invite.enabled && 'opacity-60')}>
            <div className="min-w-0 space-y-4">
              <div>
                <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Your code</p>
                <p className="mt-1 font-display text-3xl font-semibold tracking-[0.3em] text-kind-family" aria-label={`Family code ${data.invite.code.split('').join(' ')}`}>
                  {data.invite.code}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Or send the link</p>
                <div className="mt-1 flex items-center gap-2 rounded-2xl border-2 border-border bg-surface-raised p-2 pl-3">
                  <LinkSimple weight="bold" className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 break-all font-mono text-xs">{data.invite.url}</span>
                  <CopyButton text={data.invite.url} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Works until {new Date(data.invite.expires_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={data.invite.enabled ? 'outline' : 'primary'}
                  onClick={() => void change(() => familyApi.toggle(!data.invite.enabled), data.invite.enabled ? 'Invitation turned off' : 'Invitation turned on')}
                >
                  {data.invite.enabled ? <Lock weight="bold" className="size-4" /> : <LockOpen weight="bold" className="size-4" />}
                  {data.invite.enabled ? 'Turn off' : 'Turn on'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void change(() => familyApi.rotate(), 'A new code and link are ready')}>
                  <ArrowsClockwise weight="bold" className="size-4" /> New code and link
                </Button>
              </div>
            </div>
            <div className="justify-self-center [&>div]:size-40">
              <QrPicture text={data.invite.url} disabled={!data.invite.enabled} />
            </div>
          </motion.section>
        </div>
      )}
    </Card>
  )
}
