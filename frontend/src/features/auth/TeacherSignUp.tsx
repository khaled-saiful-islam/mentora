import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChalkboardTeacher } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { wobble } from '@/motion'
import { AuthLayout } from './AuthLayout'
import { PasswordInput } from './PasswordInput'
import { PasswordStrength } from './PasswordStrength'
import { errorMessage } from './errors'

export default function TeacherSignUp() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { signUpTeacher } = useAuth()
  const navigate = useNavigate()

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signUpTeacher({ name, email, password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setAttempt((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      heroTitle="Teach with a little magic."
      heroSubtitle="Make a quiz from real sources in a minute, share it with a class or a group, and watch the results come in."
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-grape-400 to-grape-700 text-white shadow-press">
        <ChalkboardTeacher weight="duotone" className="size-8" />
      </span>
      <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight">Teacher account</h1>
      <p className="mt-2 text-muted-foreground">You'll sign in with your email.</p>

      <motion.form
        key={attempt}
        onSubmit={submit}
        className="mt-8 space-y-5"
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
          />
        </Field>

        {error && <Alert>{error}</Alert>}

        <Button type="submit" size="lg" loading={busy} className="w-full">
          Create my account
        </Button>
      </motion.form>

      <p className="mt-8 text-center text-muted-foreground">
        A student?{' '}
        <Link to="/signup/student" className="font-bold text-primary hover:underline">
          Sign up here instead
        </Link>
      </p>
    </AuthLayout>
  )
}
