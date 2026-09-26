import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Bell, ChartLineUp, HeartStraight, Sparkle } from '@phosphor-icons/react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { AuthLayout, Glow } from '@/features/auth/AuthLayout'
import { errorMessage } from '@/features/auth/errors'
import { PasswordInput } from '@/features/auth/PasswordInput'
import { PasswordStrength } from '@/features/auth/PasswordStrength'
import { useCrew, useLookingAway, useWatching } from '@/features/auth/scene/crew'
import { BuddyAvatar } from '@/features/buddies'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { rise, stagger, wobble } from '@/motion'
import { familyApi, type InvitePreview } from './api'
import { LabelPicker } from './LabelPicker'

const PARENT_LINES = [
  'See how your child is getting on, every day.',
  "Know at once when something's missed.",
  'Make a quiz for them tonight, in a minute.',
] as const

const PERKS = [
  { Icon: ChartLineUp, label: 'Their progress', tone: 'bg-mint-100 text-mint-700 dark:bg-mint-700/25 dark:text-mint-100' },
  { Icon: Bell, label: 'Missed-work alerts', tone: 'bg-sun-100 text-sun-600 dark:bg-sun-600/20 dark:text-sun-300' },
  { Icon: Sparkle, label: 'Make quizzes for them', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-700/25 dark:text-sky-100' },
] as const

export default function ParentSignUp() {
  return (
    <AuthLayout
      title={
        <>
          Right there <Glow>with them.</Glow>
        </>
      }
      taglines={PARENT_LINES}
      greeting="Hello! Your child will love having you here."
    >
      <ParentForm />
    </AuthLayout>
  )
}

function ParentForm() {
  const [params] = useSearchParams()
  const invite = params.get('invite') ?? ''
  const [child, setChild] = useState<InvitePreview | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [label, setLabel] = useState('Mum')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { signUpParent } = useAuth()
  const { toast } = useToast()
  const crew = useCrew()
  const watching = useWatching()
  const lookingAway = useLookingAway()
  const navigate = useNavigate()

  useEffect(() => {
    if (!invite) return
    familyApi.preview(invite).then(setChild).catch(() => setChild(null))
  }, [invite])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const connect = await signUpParent({ name, email, password, invite: invite || undefined, label: label || undefined }, crew.celebrate)
      if (connect?.status === 'connected') toast(`You're connected to ${connect.child_name}!`, { tone: 'success' })
      if (connect?.status === 'invalid') toast("That invitation isn't working any more", { tone: 'info', body: 'Ask your child to send you a new one from My family.' })
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
        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-kind-family-vivid to-kind-family text-white shadow-press">
          <HeartStraight weight="fill" className="size-7" />
        </span>
        <p className="font-display text-sm font-bold uppercase tracking-[0.18em] text-kind-family">For parents</p>
      </div>
      <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">Follow along at home</h1>
      {child ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-3 rounded-2xl bg-kind-family-vivid/10 p-3">
          <BuddyAvatar buddy={child.buddy} mood="wave" size={44} />
          <p className="font-bold">
            {child.first_name} invited you. Make your account and you're connected.
          </p>
        </motion.div>
      ) : (
        <p className="mt-2 text-muted-foreground">Free. You'll sign in with your email, then connect with your child's invitation.</p>
      )}

      <motion.ul className="mt-5 flex flex-wrap gap-2" variants={stagger(0.08, 0.2)} initial="hidden" animate="shown">
        {PERKS.map(({ Icon, label: text, tone }) => (
          <motion.li key={text} variants={rise} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold', tone)}>
            <Icon weight="fill" className="size-3.5" />
            {text}
          </motion.li>
        ))}
      </motion.ul>

      <motion.form key={attempt} onSubmit={submit} className="mt-6 space-y-5" animate={attempt > 0 ? wobble : undefined}>
        <Field label="Your name" htmlFor="name">
          <Input id="name" autoComplete="name" autoFocus required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} {...watching} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} {...watching} />
        </Field>
        <Field label="Password" htmlFor="password" hint={<PasswordStrength password={password} />}>
          <PasswordInput id="password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} {...lookingAway} />
        </Field>
        <LabelPicker value={label} onChange={setLabel} childName={child?.first_name} />

        {error && <Alert>{error}</Alert>}

        <Button type="submit" size="lg" loading={busy} className="w-full bg-kind-family-vivid text-white">
          {!busy && <HeartStraight weight="fill" className="size-5" />}
          {child ? `Create my account and connect` : 'Create my account'}
        </Button>
      </motion.form>

      <p className="mt-7 text-center text-muted-foreground">
        Already have an account?{' '}
        <Link to="/signin" state={invite ? { from: `/family/${invite}` } : undefined} className="font-bold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}
