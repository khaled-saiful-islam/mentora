import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChalkboardTeacher, Lightning, ShieldCheck, Sparkle } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { rise, stagger, wobble } from '@/motion'
import { AuthLayout, Glow } from './AuthLayout'
import { PasswordInput } from './PasswordInput'
import { PasswordStrength } from './PasswordStrength'
import { useCrew, useLookingAway, useWatching } from './scene/crew'
import { errorMessage } from './errors'

const TEACHER_LINES = [
  'A quiz from real sources in a minute.',
  'Share it with a class or a group.',
  'Watch the results arrive live.',
  'See who needs a hand, and with what.',
] as const

const PERKS = [
  { Icon: Sparkle, label: 'Quizzes from real sources', tone: 'bg-sun-100 text-sun-600 dark:bg-sun-600/20 dark:text-sun-300' },
  { Icon: Lightning, label: 'Live results', tone: 'bg-mint-100 text-mint-700 dark:bg-mint-700/25 dark:text-mint-100' },
  { Icon: ShieldCheck, label: 'Safe for students', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-700/25 dark:text-sky-100' },
] as const

export default function TeacherSignUp() {
  return (
    <AuthLayout
      title={
        <>
          Teach with a little <Glow>magic.</Glow>
        </>
      }
      taglines={TEACHER_LINES}
      greeting="Selamat datang, Cikgu! We'll cheer your class on."
    >
      <TeacherForm />
    </AuthLayout>
  )
}

function TeacherForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { signUpTeacher } = useAuth()
  const crew = useCrew()
  const watching = useWatching()
  const lookingAway = useLookingAway()
  const navigate = useNavigate()

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signUpTeacher({ name, email, password }, crew.celebrate)
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setAttempt((n) => n + 1)
      crew.oops()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-grape-400 to-grape-700 text-white shadow-press">
          <ChalkboardTeacher weight="duotone" className="size-7" />
        </span>
        <p className="font-display text-sm font-bold uppercase tracking-[0.18em] text-primary">For teachers</p>
      </div>
      <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">Your classroom, supercharged</h1>
      <p className="mt-2 text-muted-foreground">Free to start. You'll sign in with your email.</p>

      <motion.ul className="mt-5 flex flex-wrap gap-2" variants={stagger(0.08, 0.2)} initial="hidden" animate="shown">
        {PERKS.map(({ Icon, label, tone }) => (
          <motion.li key={label} variants={rise} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold', tone)}>
            <Icon weight="fill" className="size-3.5" />
            {label}
          </motion.li>
        ))}
      </motion.ul>

      <motion.form
        key={attempt}
        onSubmit={submit}
        className="mt-6 space-y-5"
        animate={attempt > 0 ? wobble : undefined}
      >
        <Field label="Your name" htmlFor="name" hint="How your students will see you — e.g. Cikgu Aisyah.">
          <Input
            id="name"
            autoComplete="name"
            autoFocus
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            {...watching}
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            {...watching}
          />
        </Field>
        <Field label="Password" htmlFor="password" hint={<PasswordStrength password={password} />}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            {...lookingAway}
          />
        </Field>

        {error && <Alert>{error}</Alert>}

        <Button type="submit" size="lg" loading={busy} className="w-full">
          {!busy && <Sparkle weight="fill" className="size-5" />}
          Create my account
        </Button>
      </motion.form>

      <p className="mt-7 text-center text-muted-foreground">
        A student?{' '}
        <Link to="/signup/student" className="font-bold text-primary hover:underline">
          Sign up here instead
        </Link>
      </p>
    </>
  )
}
