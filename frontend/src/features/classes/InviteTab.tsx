import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowsClockwise, Check, Copy, Link as LinkIcon, Lock, LockOpen } from '@phosphor-icons/react'
import { Alert, Button, Card, Skeleton } from '@/components/ui'
import { Confirm } from '@/components/ui/Confirm'
import { Segmented } from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { useResource } from '@/hooks/useResource'
import { spring } from '@/motion'
import { cn } from '@/lib/utils'
import { classesApi, type ClassRoom, type Invite } from './api'

const EXPIRIES = [
  { value: 'never', label: 'Never', days: 0 },
  { value: '1', label: '1 day', days: 1 },
  { value: '7', label: '1 week', days: 7 },
  { value: '30', label: '30 days', days: 30 },
] as const
type Expiry = (typeof EXPIRIES)[number]['value']

/**
 * The way in: a big code for the whiteboard, a link to paste, a QR code for
 * the projector — and the switches to close or change them.
 */
export function InviteTab({ room }: { room: ClassRoom }) {
  const invite = useResource(`invite:${room.id}`, () => classesApi.invite(room.id))
  const [rotating, setRotating] = useState(false)
  const { toast } = useToast()

  async function apply(change: () => Promise<Invite>, message: string) {
    try {
      invite.setData(await change())
      toast(message)
    } catch (error) {
      toast('That did not work', { tone: 'error', body: errorMessage(error) })
    }
  }

  if (invite.error) return <Alert>{invite.error}</Alert>
  const data = invite.data
  if (!data) return <Skeleton className="h-80 rounded-[1.75rem]" />
  const link = `${window.location.origin}${data.path}`
  const expiry = expiryOf(data)

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <Card className={cn('min-w-0 p-6 sm:p-8', !data.enabled && 'opacity-60')}>
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Class code</p>
        <CodeTiles code={data.code} />
        <p className="mt-4 text-muted-foreground">
          Students tap <span className="font-bold text-foreground">Join a class</span> and type this in.
        </p>

        <p className="mt-8 text-sm font-bold uppercase tracking-wider text-muted-foreground">Invite link</p>
        <div className="mt-2 flex items-center gap-2 rounded-2xl border-2 border-border bg-surface-raised p-2 pl-4">
          <LinkIcon weight="bold" className="size-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 break-all font-mono text-sm">{link}</span>
          <CopyButton text={link} />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            variant={data.enabled ? 'outline' : 'primary'}
            onClick={() => void apply(() => classesApi.configureInvite(room.id, { enabled: !data.enabled }), data.enabled ? 'Invite turned off' : 'Invite turned on')}
          >
            {data.enabled ? <Lock weight="bold" className="size-5" /> : <LockOpen weight="bold" className="size-5" />}
            {data.enabled ? 'Turn off' : 'Turn on'}
          </Button>
          <Button variant="ghost" onClick={() => setRotating(true)}>
            <ArrowsClockwise weight="bold" className="size-5" />
            New code and link
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold">Expires</span>
          <Segmented
            label="Invite expires"
            value={expiry}
            onChange={(value) => void apply(() => classesApi.configureInvite(room.id, expiryPatch(value)), value === 'never' ? 'Invite never expires' : 'Expiry set')}
            options={EXPIRIES.map(({ value, label }) => ({ value, label }))}
          />
        </div>
        {data.expires_at && (
          <p className="mt-2 text-sm text-muted-foreground">Until {new Date(data.expires_at).toLocaleString()}</p>
        )}
      </Card>

      <Card className="flex min-w-0 flex-col items-center justify-center p-6 text-center">
        <QrPicture text={link} disabled={!data.enabled} />
        <p className="mt-4 font-bold">Scan to join {room.name}</p>
        <p className="text-sm text-muted-foreground">Put it on the projector — phones and tablets can scan it.</p>
      </Card>

      {rotating && (
        <Confirm
          title="Make a new code and link?"
          body="The old code and link stop working at once. Students already in the class stay in."
          confirmLabel="Make new ones"
          destructive={false}
          onConfirm={() => {
            setRotating(false)
            void apply(() => classesApi.rotateInvite(room.id), 'New code and link ready')
          }}
          onCancel={() => setRotating(false)}
        />
      )}
    </div>
  )
}

/** Six big letters that flip in one after another when the code changes. */
function CodeTiles({ code }: { code: string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label={`Class code ${code.split('').join(' ')}`}>
      {code.split('').map((letter, index) => (
        <AnimatePresence mode="popLayout" key={index}>
          <motion.span
            key={`${code}-${index}`}
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1, transition: { ...spring.bouncy, delay: index * 0.06 } }}
            exit={{ rotateX: 90, opacity: 0, transition: { duration: 0.12 } }}
            className="grid size-12 place-items-center rounded-2xl bg-gradient-to-b from-grape-500 to-grape-700 font-display text-3xl font-semibold text-white shadow-press sm:size-16 sm:text-4xl"
            aria-hidden
          >
            {letter}
          </motion.span>
        </AnimatePresence>
      ))}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy this link', text)
    }
  }
  return (
    <Button size="sm" onClick={() => void copy()} aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={copied ? 'done' : 'copy'} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="inline-flex items-center gap-1.5">
          {copied ? <Check weight="bold" className="size-4" /> : <Copy weight="bold" className="size-4" />}
          {copied ? 'Copied!' : 'Copy'}
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}

function QrPicture({ text, disabled }: { text: string; disabled: boolean }) {
  const [svg, setSvg] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1E1B3A', light: '#FFFFFF' } })
      .then((markup) => live && setSvg(markup))
      .catch(() => live && setSvg(null))
    return () => {
      live = false
    }
  }, [text])
  return (
    <motion.div
      key={text}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: disabled ? 0.3 : 1 }}
      transition={spring.gentle}
      className="size-56 overflow-hidden rounded-3xl bg-white p-3 shadow-sm [&_svg]:size-full"
      role="img"
      aria-label="QR code for the invite link"
      // The QR library returns markup it generated from our own link; there is
      // no user-supplied HTML in it.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  )
}

function expiryOf(invite: Invite): Expiry {
  if (!invite.expires_at) return 'never'
  const days = (new Date(invite.expires_at).getTime() - Date.now()) / 86_400_000
  return days <= 1.5 ? '1' : days <= 8 ? '7' : '30'
}

function expiryPatch(value: Expiry) {
  const days = EXPIRIES.find((e) => e.value === value)?.days ?? 0
  if (!days) return { clear_expiry: true }
  return { expires_at: new Date(Date.now() + days * 86_400_000).toISOString() }
}
