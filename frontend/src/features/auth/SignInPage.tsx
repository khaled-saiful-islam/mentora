import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { SignIn as SignInIcon } from '@phosphor-icons/react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { wobble } from '@/motion'
import { AuthLayout } from './AuthLayout'
import { PasswordInput } from './PasswordInput'
import { errorMessage } from './errors'

export default function SignInPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(identifier, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setAttempt((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Welcome back!</h1>
      <p className="mt-2 text-muted-foreground">Sign in to pick up where you left off.</p>

      <motion.form
        key={attempt}
        onSubmit={submit}
        className="mt-8 space-y-5"
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
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {error && <Alert>{error}</Alert>}

        <Button type="submit" size="lg" loading={busy} className="w-full">
          {!busy && <SignInIcon weight="bold" className="size-5" />}
          Sign in
        </Button>
      </motion.form>

      <p className="mt-8 text-center text-muted-foreground">
        New to Mentora?{' '}
        <Link to="/signup" className="font-bold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
