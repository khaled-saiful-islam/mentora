/**
 * A parent's home: each child they follow — their buddy, their classes and
 * teachers — and a way to connect another with the child's code.
 */
import { ChalkboardTeacher, HeartStraight, LinkBreak, UsersThree } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Alert, Button, Card, Skeleton } from '@/components/ui'
import { Confirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { Buddy, greeting } from '@/features/buddies'
import { CodeInput } from '@/features/classes/CodeInput'
import { useResource } from '@/hooks/useResource'
import { useAuth } from '@/lib/auth'
import { useLive } from '@/lib/bus'
import { lookOf } from '@/lib/palette'
import { firstName } from '@/lib/user'
import { cn } from '@/lib/utils'
import { Page, rise, stagger } from '@/motion'
import { familyApi, type Child } from './api'
import { LabelPicker } from './LabelPicker'

export default function ParentHome() {
  const { user } = useAuth()
  const children = useResource('my-children', () => familyApi.children())
  useLive(['family', 'classes'], () => void children.reload())
  const items = children.data?.items ?? []

  return (
    <Page className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-kind-family-vivid via-kind-family-vivid to-kind-family p-6 text-white shadow-lg md:p-8">
        <motion.span
          aria-hidden
          className="absolute -top-6 right-10 text-white/20"
          animate={{ y: [0, -8, 0], rotate: [0, 8, 0] }}
          transition={{ duration: 5, repeat: Infinity }}
        >
          <HeartStraight weight="fill" className="size-40" />
        </motion.span>
        <p className="relative font-display text-lg font-semibold opacity-85">{greeting()},</p>
        <h1 className="relative mt-1 font-display text-4xl font-semibold tracking-tight md:text-5xl">{user ? firstName(user) : 'there'}!</h1>
        <p className="relative mt-2 max-w-xl opacity-90">
          {items.length === 0
            ? "Connect to your child and you'll see everything they're learning."
            : `Here's how ${items.map((c) => c.first_name).join(' and ')} ${items.length === 1 ? 'is' : 'are'} getting on.`}
        </p>
      </section>

      {children.error && <Alert className="mt-6">{children.error}</Alert>}
      {!children.data ? (
        <Skeleton className="mt-6 h-64 rounded-[1.75rem]" />
      ) : (
        <div className={cn('mt-6 grid gap-5', items.length > 0 && 'lg:grid-cols-[minmax(0,1fr)_22rem]')}>
          {items.length > 0 && (
            <motion.ul className="space-y-5" variants={stagger(0.08)} initial="hidden" animate="shown">
              {items.map((child) => (
                <ChildCard key={child.id} child={child} onGone={() => void children.reload()} />
              ))}
            </motion.ul>
          )}
          <ConnectCard first={items.length === 0} onConnected={() => void children.reload()} />
        </div>
      )}
    </Page>
  )
}

function ChildCard({ child, onGone }: { child: Child; onGone: () => void }) {
  const classes = useResource(`child-classes:${child.id}`, () => familyApi.classes(child.id))
  const [leaving, setLeaving] = useState(false)
  const { toast } = useToast()

  async function disconnect() {
    setLeaving(false)
    try {
      await familyApi.disconnect(child.id)
      toast(`You're no longer following ${child.first_name}`, { tone: 'info' })
      onGone()
    } catch (e) {
      toast('That did not work', { tone: 'error', body: errorMessage(e) })
    }
  }

  const rooms = classes.data?.items ?? []
  return (
    <motion.li variants={rise}>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 border-b border-border bg-kind-family-vivid/8 p-5">
          <Buddy buddy={child.buddy} size={84} mood="happy" bubble="top" />
          <div className="min-w-[min(100%,12rem)] flex-1">
            <p className="text-xs font-bold tracking-wide text-kind-family uppercase">You're their {child.label}</p>
            <h2 className="break-words font-display text-3xl font-semibold">{child.name}</h2>
            {child.grade_label && <p className="text-sm font-bold text-muted-foreground">{child.grade_label}</p>}
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLeaving(true)}>
            <LinkBreak weight="bold" className="size-4" /> Disconnect
          </Button>
        </div>
        <div className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground/85">
            <UsersThree weight="duotone" className="size-5 text-kind-family" aria-hidden /> Classes and teachers
          </h3>
          {!classes.data ? (
            <Skeleton className="mt-3 h-16 rounded-2xl" />
          ) : rooms.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{child.first_name} isn't in a class yet. When they join one, it shows up here with their teacher.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {rooms.map((room) => {
                const look = lookOf(room.theme)
                return (
                  <li key={room.class_id} className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
                    <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', look.hero, look.onHero)}>
                      <ChalkboardTeacher weight="duotone" className="size-6" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block break-words font-bold leading-snug">{room.class_name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {[room.subject, `with ${room.teacher_name}`].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>
      {leaving && (
        <Confirm
          title={`Stop following ${child.first_name}?`}
          body={`You'll stop seeing their work and getting their alerts. ${child.first_name} can invite you again any time.`}
          confirmLabel="Disconnect"
          onConfirm={() => void disconnect()}
          onCancel={() => setLeaving(false)}
        />
      )}
    </motion.li>
  )
}

/** Type the child's code — the same one their invitation link carries. */
function ConnectCard({ first, onConnected }: { first: boolean; onConnected: () => void }) {
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('Mum')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  async function connect(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const child = await familyApi.connect(code, label)
      toast(`You're connected to ${child.first_name}!`, { tone: 'success' })
      setCode('')
      onConnected()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={cn('self-start overflow-hidden', first && 'mx-auto w-full max-w-xl')}>
      <form onSubmit={connect} className="space-y-4 p-5">
        <div>
          <h2 className="font-display text-xl font-semibold">{first ? 'Connect to your child' : 'Connect another child'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            On their Mentora, they open <span className="font-bold text-foreground">Settings → My family</span> and read you the 6-letter code — or send you the link.
          </p>
        </div>
        <CodeInput compact value={code} onChange={(next) => { setCode(next); setError(null) }} invalid={Boolean(error)} />
        <LabelPicker value={label} onChange={setLabel} />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" className="w-full bg-kind-family-vivid text-white" disabled={code.length < 6 || !label.trim()} loading={busy}>
          {!busy && <HeartStraight weight="fill" className="size-4" />}
          Connect
        </Button>
      </form>
    </Card>
  )
}
