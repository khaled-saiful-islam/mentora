import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Backpack, CheckCircle, HourglassMedium, SignOut, Sparkle, UsersThree } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, Chip, Skeleton } from '@/components/ui'
import { Confirm } from '@/components/ui/Confirm'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { useResource } from '@/hooks/useResource'
import { Page, pop, rise, stagger } from '@/motion'
import { lookOf } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { classesApi, type StudentClass } from './api'
import { CodeInput } from './CodeInput'
import { EmptyArt } from './EmptyArt'

export default function StudentClassesPage() {
  const classes = useResource('my-classes', () => classesApi.mine())
  const [leaving, setLeaving] = useState<StudentClass | null>(null)
  const { toast } = useToast()
  const items = classes.data?.items ?? []
  const current = items.filter((c) => c.status === 'approved' || c.status === 'pending')
  const past = items.filter((c) => c.status !== 'approved' && c.status !== 'pending')

  async function leave(room: StudentClass) {
    setLeaving(null)
    try {
      await classesApi.leave(room.class_id)
      toast(`You left ${room.class_name}`, { tone: 'info' })
      await classes.reload()
    } catch (error) {
      toast('Could not leave', { tone: 'error', body: errorMessage(error) })
    }
  }

  return (
    <Page className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">My classes</h1>
      <p className="mt-1 text-muted-foreground">Where your teachers share quizzes and flashcards with you.</p>

      <JoinCard onJoined={() => void classes.reload()} />

      {classes.error && <Alert className="mt-6">{classes.error}</Alert>}
      <section className="mt-10">
        {classes.loading && !classes.data ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-36 rounded-[1.75rem]" />
            ))}
          </div>
        ) : current.length === 0 ? (
          <EmptyState
            art={<EmptyArt Icon={Backpack} tone="from-sun-100 to-mint-100" />}
            title="No classes yet"
            body="Ask your teacher for a class code or an invite link, then pop it in above!"
          />
        ) : (
          <motion.ul className="grid gap-4 sm:grid-cols-2" variants={stagger(0.07)} initial="hidden" animate="shown">
            {current.map((room) => (
              <ClassTile key={room.class_id} room={room} onLeave={() => setLeaving(room)} />
            ))}
          </motion.ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold text-muted-foreground">Earlier</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {past.map((room) => (
              <li key={room.class_id}>
                <Chip>{room.class_name} · {PAST[room.status] ?? room.status}</Chip>
              </li>
            ))}
          </ul>
        </section>
      )}

      {leaving && (
        <Confirm
          title={`Leave ${leaving.class_name}?`}
          body="You'll stop getting new work from this class. Your results stay yours, and you can ask to join again with the code."
          confirmLabel="Leave class"
          onConfirm={() => void leave(leaving)}
          onCancel={() => setLeaving(null)}
        />
      )}
    </Page>
  )
}

const PAST: Record<string, string> = { rejected: 'not approved', revoked: 'removed', left: 'you left' }

function ClassTile({ room, onLeave }: { room: StudentClass; onLeave: () => void }) {
  const look = lookOf(room.theme)
  const waiting = room.status === 'pending'
  return (
    <motion.li variants={rise} layout>
      <Card className="overflow-hidden">
        <Link
          to={`/classes/${room.class_id}`}
          className={cn('group relative block p-5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40', look.hero, look.onHero)}
        >
          <p className="text-sm font-bold opacity-85">{room.subject ?? 'Class'}</p>
          <p className="font-display text-2xl font-semibold">{room.class_name}</p>
          <p className="text-sm opacity-90">with {room.teacher_name}</p>
          {!waiting && (
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/25 px-3 py-1 text-sm font-bold transition-transform group-hover:translate-x-1">
              Open class <ArrowRight weight="bold" className="size-4" />
            </span>
          )}
          <UsersThree weight="duotone" aria-hidden className="absolute -bottom-3 right-3 size-20 opacity-25 transition-transform group-hover:rotate-6" />
        </Link>
        <div className="flex flex-wrap items-center gap-2 p-4">
          {waiting ? (
            <Chip tone="sun">
              <motion.span animate={{ rotate: [0, 180, 180, 360] }} transition={{ duration: 2.4, repeat: Infinity }}>
                <HourglassMedium weight="fill" className="size-3.5" />
              </motion.span>
              Waiting for your teacher
            </Chip>
          ) : (
            <Chip tone="mint">
              <CheckCircle weight="fill" className="size-3.5" />
              You're in!
            </Chip>
          )}
          {room.groups.map((group) => (
            <Chip key={group} tone="grape">{group}</Chip>
          ))}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onLeave}>
            <SignOut weight="bold" className="size-4" />
            Leave
          </Button>
        </div>
      </Card>
    </motion.li>
  )
}

/** Type a class code, press Join, watch it land. */
function JoinCard({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function join(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await classesApi.join(code)
      setDone(
        result.status === 'member'
          ? `You're already in ${result.invite.class_name}!`
          : `Asked to join ${result.invite.class_name} — ${result.invite.teacher_name} will let you in soon.`,
      )
      setCode('')
      onJoined()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-8 overflow-hidden">
      <form onSubmit={join} className="relative p-6 text-center sm:p-8">
        <span className="blob -left-10 -top-16 size-48 bg-sun-300" aria-hidden />
        <span className="blob -bottom-20 right-0 size-48 bg-grape-300" aria-hidden />
        <div className="relative">
          <h2 className="font-display text-2xl font-semibold">Join a class</h2>
          <p className="mt-1 text-muted-foreground">Type the 6-letter code your teacher gave you.</p>
          <div className="mt-6">
            <CodeInput value={code} onChange={(next) => { setCode(next); setError(null); setDone(null) }} invalid={Boolean(error)} />
          </div>
          <AnimatePresence mode="wait">
            {error && (
              <motion.p key="error" className="mt-4 font-semibold text-destructive" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {error}
              </motion.p>
            )}
            {done && (
              <motion.p key="done" variants={pop} initial="hidden" animate="shown" exit="hidden" className="mt-4 inline-flex items-center gap-2 font-bold text-success">
                <Sparkle weight="fill" className="size-5 text-sun-400" />
                {done}
              </motion.p>
            )}
          </AnimatePresence>
          <Button type="submit" size="lg" variant="sun" className="mt-6 min-w-40" disabled={code.length < 6} loading={busy}>
            Join
          </Button>
        </div>
      </form>
    </Card>
  )
}
