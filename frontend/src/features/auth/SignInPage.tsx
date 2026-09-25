import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, SignIn as SignInIcon } from '@phosphor-icons/react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { wobble } from '@/motion'
import { AuthLayout, Glow } from './AuthLayout'
import { PasswordInput } from './PasswordInput'
import { useCrew, useLookingAway, useWatching } from './scene/crew'
import { errorMessage } from './errors'

export default function SignInPage() {
  return (
    <AuthLayout
      title={
        <>
          Welcome back to <Glow>Mentora.</Glow>
        </>
      }
      greeting="Welcome back! We saved your spot."
    >
      <SignInForm />
    </AuthLayout>
  )
}

function SignInForm() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const { signIn } = useAuth()
  const crew = useCrew()
  const watching = useWatching()
  const lookingAway = useLookingAway()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(identifier, password, crew.celebrate)
      navigate(from, { replace: true })
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
      <p className="font-display text-sm font-bold uppercase tracking-[0.18em] text-primary">Sign in</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Hello again!</h1>
      <p className="mt-2 text-muted-foreground">Your buddy has been waiting for you.</p>

      <motion.form
        key={attempt}
        onSubmit={submit}
        className="mt-7 space-y-5"
        animate={attempt > 0 ? wobble : undefined}
      >
        <Field label="Username or email" htmlFor="identifier">
          <Input
            id="identifier"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            required
            placeholder="e.g. adam_5b or cikgu@school.my"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            {...watching}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            {...lookingAway}
          />
        </Field>

        {error && <Alert>{error}</Alert>}

        <Button type="submit" size="lg" loading={busy} className="group w-full">
          {!busy && <SignInIcon weight="bold" className="size-5" />}
          Let me in
          {!busy && <ArrowRight weight="bold" className="size-5 transition-transform group-hover:translate-x-1" />}
        </Button>
      </motion.form>

      <div className="mt-7 flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        New to Mentora?
        <span className="h-px flex-1 bg-border" />
      </div>
      <Link
        to="/signup"
        className="mt-4 flex items-center justify-center gap-2 rounded-full border-2 border-border bg-surface px-5 py-3 font-bold text-foreground transition-colors hover:border-hover-border hover:bg-hover"
      >
        Create an account — it's free
      </Link>
    </>
  )
}
