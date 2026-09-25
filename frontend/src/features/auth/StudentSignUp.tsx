import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Backpack, Sparkle } from '@phosphor-icons/react'
import { Alert, Button, Input } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/ui/Toast'
import { spring } from '@/motion'
import { cn } from '@/lib/utils'
import { AuthLayout } from './AuthLayout'
import { GradePicker } from './GradePicker'
import { PasswordInput } from './PasswordInput'
import { UsernameField } from './UsernameField'
import { useGrades } from './useGrades'
import { errorMessage } from './errors'

type Step = 'name' | 'grade' | 'username' | 'password'
const STEPS: readonly Step[] = ['name', 'grade', 'username', 'password']

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
 * four questions; a wall of fields is where they give up.
 */
export default function StudentSignUp() {
  const [draft, setDraft] = useState<Draft>({ name: '', grade: '', username: '', password: '' })
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [usernameOk, setUsernameOk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { signUpStudent } = useAuth()
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
      })
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
    } finally {
      setBusy(false)
    }
  }

  function next(event?: React.FormEvent) {
    event?.preventDefault()
    if (!ready || busy) return
    if (index < STEPS.length - 1) go(index + 1)
    else void submit()
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <AuthLayout
      heroTitle="Ready to learn and play?"
      heroSubtitle="Quizzes that cheer you on, flashcards that flip, and badges to collect. Let's make your account!"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-sun-300 to-sun-400 text-grape-900 shadow-press">
          <Backpack weight="duotone" className="size-7" />
        </span>
        <Progress index={index} />
      </div>

      <form onSubmit={next} className="mt-8">
        <div className="relative min-h-[19rem]">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              variants={slide}
              initial="enter"
              animate="centre"
              exit="exit"
            >
              <StepBody step={step} draft={draft} set={set} onUsernameValidity={setUsernameOk} />
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
    </AuthLayout>
  )
}

function Progress({ index }: { index: number }) {
  return (
    <div className="flex-1">
      <p className="text-sm font-bold text-muted-foreground">
        Step {index + 1} of {STEPS.length}
      </p>
      <div
        className="mt-1.5 h-3 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={index + 1}
        aria-label="Sign-up progress"
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-sun-400 via-coral-400 to-grape-500"
          initial={false}
          animate={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
          transition={spring.gentle}
        />
      </div>
    </div>
  )
}

function StepBody({
  step,
  draft,
  set,
  onUsernameValidity,
}: {
  step: Step
  draft: Draft
  set: (patch: Partial<Draft>) => void
  onUsernameValidity: (ok: boolean) => void
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
