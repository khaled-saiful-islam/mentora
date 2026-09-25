import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ChalkboardTeacher, Confetti, HourglassMedium, LinkBreak, PaperPlaneTilt, SignIn, UserPlus } from '@phosphor-icons/react'
import { Button, Spinner } from '@/components/ui'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { errorMessage } from '@/features/auth/errors'
import { useAuth } from '@/lib/auth'
import { lookOf } from '@/lib/palette'
import { can } from '@/lib/user'
import { pop, spring } from '@/motion'
import { cn } from '@/lib/utils'
import { classesApi, type InvitePreview, type JoinResult } from './api'

type State =
  | { phase: 'loading' }
  | { phase: 'dead'; message: string }
  | { phase: 'preview'; invite: InvitePreview }
  | { phase: 'joining'; invite: InvitePreview }
  | { phase: 'joined'; result: JoinResult }

/**
 * Where an invite link lands. Signed out: see the class, then sign up or sign
 * in. A student already signed in: the request goes at once — the link was
 * the click. Anyone else: told kindly that this is for students.
 */
export default function JoinPage() {
  const { key = '' } = useParams()
  const { user, loading } = useAuth()
  const [state, setState] = useState<State>({ phase: 'loading' })
  const asked = useRef(false)
  const student = can(user, 'join_classes')

  useEffect(() => {
    classesApi
      .previewInvite(key)
      .then((invite) => setState({ phase: 'preview', invite }))
      .catch((error) => setState({ phase: 'dead', message: errorMessage(error) }))
  }, [key])

  useEffect(() => {
    if (loading || !student || asked.current || state.phase !== 'preview') return
    asked.current = true
    setState({ phase: 'joining', invite: state.invite })
    classesApi
      .join(key)
      .then((result) => setState({ phase: 'joined', result }))
      .catch((error) => setState({ phase: 'dead', message: errorMessage(error) }))
  }, [loading, student, state, key])

  return (
    <AuthLayout heroTitle="You're invited!" heroSubtitle="Join your class on Mentora to play the quizzes and flashcards your teacher shares.">
      {state.phase === 'loading' || state.phase === 'joining' ? (
        <div className="grid place-items-center py-24">
          <Spinner className="size-10" />
        </div>
      ) : state.phase === 'dead' ? (
        <Dead message={state.message} student={student} />
      ) : state.phase === 'joined' ? (
        <Joined result={state.result} />
      ) : (
        <Preview invite={state.invite} inviteKey={key} signedIn={Boolean(user)} />
      )}
    </AuthLayout>
  )
}

function ClassBadge({ invite }: { invite: InvitePreview }) {
  const look = lookOf(invite.theme)
  return (
    <motion.div
      className={cn('relative overflow-hidden rounded-[1.75rem] p-6 shadow-press', look.hero, look.onHero)}
      initial={{ opacity: 0, rotate: -3, y: 16 }}
      animate={{ opacity: 1, rotate: 0, y: 0 }}
      transition={spring.bouncy}
    >
      <ChalkboardTeacher weight="duotone" aria-hidden className="absolute -bottom-4 -right-2 size-28 opacity-25" />
      <p className="font-bold opacity-85">{[invite.subject, invite.grade_label].filter(Boolean).join(' · ') || 'Class'}</p>
      <p className="font-display text-3xl font-semibold">{invite.class_name}</p>
      <p className="mt-1 font-bold opacity-90">with {invite.teacher_name}</p>
    </motion.div>
  )
}

function Preview({ invite, inviteKey, signedIn }: { invite: InvitePreview; inviteKey: string; signedIn: boolean }) {
  if (signedIn) {
    return (
      <div className="space-y-6">
        <ClassBadge invite={invite} />
        <p className="text-muted-foreground">This invite is for students. Share it with your class — students who open it can ask to join.</p>
        <Link to="/classes"><Button variant="outline">Back to classes</Button></Link>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Hi there!</h1>
      <p className="text-lg text-muted-foreground">{invite.teacher_name} invited you to join</p>
      <ClassBadge invite={invite} />
      <div className="grid gap-3">
        <Link to={`/signup/student?invite=${encodeURIComponent(inviteKey)}`}>
          <Button size="lg" variant="sun" className="w-full">
            <UserPlus weight="bold" className="size-5" />
            I'm new — make my account
          </Button>
        </Link>
        <Link to="/signin" state={{ from: `/join/${inviteKey}` }}>
          <Button size="lg" variant="outline" className="w-full">
            <SignIn weight="bold" className="size-5" />
            I already have an account
          </Button>
        </Link>
      </div>
    </div>
  )
}

const JOINED = {
  requested: { Icon: PaperPlaneTilt, title: 'Request sent!', body: (t: string) => `${t} will let you in soon. We'll tell you the moment they do.` },
  pending: { Icon: HourglassMedium, title: 'Still waiting', body: (t: string) => `You've already asked — ${t} just needs to let you in.` },
  member: { Icon: Confetti, title: "You're already in!", body: () => 'This is one of your classes.' },
} as const

function Joined({ result }: { result: JoinResult }) {
  const view = JOINED[result.status]
  return (
    <div className="space-y-6 text-center">
      <motion.div variants={pop} initial="hidden" animate="shown" className="mx-auto grid size-24 place-items-center rounded-[2rem] bg-gradient-to-br from-sun-300 to-coral-400 text-white shadow-press">
        <motion.span animate={result.status === 'requested' ? { x: [0, 30, 0], y: [0, -30, 0], rotate: [0, 12, 0] } : undefined} transition={{ duration: 1.2, delay: 0.3 }}>
          <view.Icon weight="fill" className="size-12" />
        </motion.span>
      </motion.div>
      <h1 className="font-display text-4xl font-semibold tracking-tight">{view.title}</h1>
      <p className="text-lg text-muted-foreground">{view.body(result.invite.teacher_name)}</p>
      <ClassBadge invite={result.invite} />
      <Link to="/classes"><Button size="lg" className="w-full">Go to my classes</Button></Link>
    </div>
  )
}

function Dead({ message, student }: { message: string; student: boolean }) {
  return (
    <div className="space-y-5 text-center">
      <motion.div variants={pop} initial="hidden" animate="shown" className="mx-auto grid size-24 place-items-center rounded-[2rem] bg-muted text-muted-foreground">
        <LinkBreak weight="duotone" className="size-12" />
      </motion.div>
      <h1 className="font-display text-3xl font-semibold">Hmm, that invite didn't work</h1>
      <p className="text-muted-foreground">{message}</p>
      <Link to={student ? '/classes' : '/signin'}>
        <Button variant="outline">{student ? 'Type a class code instead' : 'Go to sign in'}</Button>
      </Link>
    </div>
  )
}
