import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, At, GraduationCap, LockKey, Smiley, Sparkle } from '@phosphor-icons/react'
import { Alert, Button, Input } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/Toast'
import { StepStones, type Stone } from './StepStones'
import { useCrew, useLookingAway, useWatching } from './scene/crew'
import { spring } from '@/motion'
import { cn } from '@/lib/utils'
import { AuthLayout, Glow } from './AuthLayout'
import { GradePicker } from './GradePicker'
import { PasswordInput } from './PasswordInput'
import { UsernameField } from './UsernameField'
import { useGrades } from './useGrades'
import { errorMessage } from './errors'

type Step = 'name' | 'grade' | 'username' | 'password'
const STEPS: readonly Step[] = ['name', 'grade', 'username', 'password']
const STONES: readonly Stone[] = [
  { label: 'Name', Icon: Smiley },
  { label: 'Year', Icon: GraduationCap },
  { label: 'Username', Icon: At },
  { label: 'Password', Icon: LockKey },
]

interface Draft {
  name: string
  grade: string
  username: string
  password: string
}

/** Steps slide in from the side they are going to. */
const slide = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 48 }),
  centre: { opacity: 1, x: 0, transition: spring.gentle },
  exit: (direction: number) => ({ opacity: 0, x: direction * -48, transition: { duration: 0.15 } }),
}

/**
 * Four small questions instead of one long form — a nine-year-old finishes
 * four questions; a wall of fields is where they give up. Kiko hops along
 * the stones as they go, and the buddies below cheer each answer.
 */
export default function StudentSignUp() {
  return (
    <AuthLayout
      title={
        <>
          Ready to learn <Glow>and play?</Glow>
        </>
      }
      greeting="Yay! Let's make your account together."
    >
      <StudentForm />
    </AuthLayout>
  )
}

function StudentForm() {
  const [draft, setDraft] = useState<Draft>({ name: '', grade: '', username: '', password: '' })
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [usernameOk, setUsernameOk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { signUpStudent } = useAuth()
  const crew = useCrew()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const invite = params.get('invite') ?? undefined

  const step = STEPS[index]
  const ready = {
    name: draft.name.trim().length > 0,
    grade: draft.grade !== '',
    username: usernameOk,
    password: draft.password.length >= 8,
  }[step]

  function go(to: number) {
    // The field that had focus is about to go without a blur; the next
    // one's autofocus sets the buddies again.
    crew.setReaction('idle')
    setDirection(to > index ? 1 : -1)
    setError(null)
    setIndex(to)
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const join = await signUpStudent({
        name: draft.name,
        grade_level: draft.grade,
        username: draft.username,
        password: draft.password,
        invite_token: invite,
      }, crew.celebrate)
      if (join && join.status !== 'invalid') {
        toast(`Asked to join ${join.class_name}!`, { body: `${join.teacher_name} will let you in soon.` })
        navigate('/classes', { replace: true })
      } else {
        if (join?.status === 'invalid') {
          toast('Your account is ready', { tone: 'info', body: "That invite had stopped working — ask your teacher for a class code." })
        }
        navigate('/', { replace: true })
      }
    } catch (err) {
      setError(errorMessage(err))
      crew.oops()
    } finally {
      setBusy(false)
    }
  }

  function next(event?: React.FormEvent) {
    event?.preventDefault()
    if (!ready || busy) return
    if (index < STEPS.length - 1) {
      cheer(step)
      go(index + 1)
    } else void submit()
  }

  // A word from a buddy after each answer — never the same one twice running.
  const cheerer = useRef(0)
  function cheer(done: Step) {
    const first = draft.name.trim().split(/\s+/)[0]
    const line = {
      name: `${first}! What a great name!`,
      grade: 'Ooh, great year to be in!',
      username: "That one's all yours!",
      password: '',
    }[done]
    if (!line) return
    cheerer.current = (cheerer.current + 2) % 5
    crew.say(line, cheerer.current)
  }

  // Everyone leans in to listen while a box has focus.
  const watching = useWatching()
  const lookingAway = useLookingAway()


  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <>
      <StepStones stones={STONES} index={index} />

      <form onSubmit={next} className="mt-6">
        <div className="relative min-h-[17rem]">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              variants={slide}
              initial="enter"
              animate="centre"
              exit="exit"
            >
              <StepBody
                step={step}
                draft={draft}
                set={set}
                onUsernameValidity={setUsernameOk}
                watching={watching}
                lookingAway={lookingAway}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {error && <Alert className="mt-4">{error}</Alert>}

        <div className="mt-6 flex items-center gap-3">
          {index > 0 && (
            <Button type="button" variant="outline" size="lg" onClick={() => go(index - 1)} aria-label="Back">
              <ArrowLeft weight="bold" className="size-5" />
            </Button>
          )}
          <Button type="submit" size="lg" variant={index === STEPS.length - 1 ? 'sun' : 'primary'} disabled={!ready} loading={busy} className="flex-1">
            {index === STEPS.length - 1 ? (
              <>
                {!busy && <Sparkle weight="fill" className="size-5" />}
                Let's go!
              </>
            ) : (
              <>
                Next
                <ArrowRight weight="bold" className="size-5" />
              </>
            )}
          </Button>
        </div>
      </form>

      <p className="mt-8 text-center text-muted-foreground">
        Already have an account?{' '}
        <Link to="/signin" className="font-bold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}

type Wiring = { onFocus: () => void; onBlur: () => void }

function StepBody({
  step,
  draft,
  set,
  onUsernameValidity,
  watching,
  lookingAway,
}: {
  step: Step
  draft: Draft
  set: (patch: Partial<Draft>) => void
  onUsernameValidity: (ok: boolean) => void
  watching: Wiring
  lookingAway: Wiring & { onShownChange: (shown: boolean) => void }
}) {
  const { grades } = useGrades()
  const first = draft.name.trim().split(/\s+/)[0]
  const gradeLabel = grades.find((g) => g.code === draft.grade)?.label

  switch (step) {
    case 'name':
      return (
        <Question title="Hi there! What's your name?" hint="Your teacher and classmates will see it.">
          <Input
            id="name"
            autoFocus
            autoComplete="given-name"
            maxLength={120}
            placeholder="Type your name"
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            className="h-14 text-xl"
            {...watching}
          />
        </Question>
      )
    case 'grade':
      return (
        <Question title={`Nice to meet you, ${first}! Which year or form are you in?`}>
          <GradePicker value={draft.grade} onChange={(grade) => set({ grade })} />
        </Question>
      )
    case 'username':
      return (
        <Question
          title="Pick a username"
          hint={gradeLabel ? `You'll use it to sign in. ${gradeLabel} — awesome!` : "You'll use it to sign in."}
        >
          <UsernameField
            value={draft.username}
            onChange={(username) => set({ username })}
            onValidity={onUsernameValidity}
            {...watching}
          />
        </Question>
      )
    case 'password':
      return (
        <Question title="Now a secret password" hint="At least 8 characters. Keep it to yourself!">
          <PasswordInput
            id="password"
            autoFocus
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            value={draft.password}
            onChange={(e) => set({ password: e.target.value })}
            className="h-14 text-xl"
            {...lookingAway}
          />
          <PasswordDots length={draft.password.length} />
        </Question>
      )
  }
}

function Question({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">{title}</h1>
      {hint && <p className="mt-2 text-muted-foreground">{hint}</p>}
      <div className="mt-6">{children}</div>
    </div>
  )
}

/** Eight dots that fill as the password grows — the minimum made visible. */
function PasswordDots({ length }: { length: number }) {
  return (
    <div className="mt-4 flex gap-2" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <motion.span
          key={i}
          className={cn('size-3 rounded-full', i < length ? 'bg-correct' : 'bg-muted')}
          animate={i < length ? { scale: [1, 1.4, 1] } : { scale: 1 }}
          transition={spring.bouncy}
        />
      ))}
    </div>
  )
}
