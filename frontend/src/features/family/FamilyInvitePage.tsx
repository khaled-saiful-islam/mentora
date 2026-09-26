/**
 * Where a child's invitation lands. Signed out: meet the child's buddy, then
 * make a parent account or sign in. A parent already signed in: say what the
 * child calls you, and connect. Anyone else: told kindly this is for parents.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { HeartStraight, LinkBreak, SignIn, UserPlus } from '@phosphor-icons/react'
import { Alert, Button, Spinner } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { AuthLayout, Glow } from '@/features/auth/AuthLayout'
import { errorMessage } from '@/features/auth/errors'
import { Buddy } from '@/features/buddies'
import { useAuth } from '@/lib/auth'
import { can } from '@/lib/user'
import { pop, spring } from '@/motion'
import { familyApi, type InvitePreview } from './api'
import { LabelPicker } from './LabelPicker'

const LINES = ['See every quiz, score and badge.', "Hear at once when something's missed.", 'Make practice for them, at home.'] as const

type State = { phase: 'loading' } | { phase: 'dead'; message: string } | { phase: 'preview'; child: InvitePreview }

export default function FamilyInvitePage() {
  const { key = '' } = useParams()
  const { user } = useAuth()
  const [state, setState] = useState<State>({ phase: 'loading' })

  useEffect(() => {
    familyApi
      .preview(key)
      .then((child) => setState({ phase: 'preview', child }))
      .catch((error) => setState({ phase: 'dead', message: errorMessage(error) }))
  }, [key])

  return (
    <AuthLayout
      title={
        <>
          Someone wants you <Glow>there.</Glow>
        </>
      }
      taglines={LINES}
      greeting="A family invitation!"
    >
      {state.phase === 'loading' ? (
        <div className="grid place-items-center py-24">
          <Spinner className="size-10" />
        </div>
      ) : state.phase === 'dead' ? (
        <Dead message={state.message} />
      ) : !user ? (
        <SignedOut child={state.child} inviteKey={key} />
      ) : can(user, 'see_children') ? (
        <Connect child={state.child} inviteKey={key} />
      ) : (
        <NotAParent child={state.child} />
      )}
    </AuthLayout>
  )
}

function ChildBadge({ child }: { child: InvitePreview }) {
  return (
    <motion.div
      className="relative flex items-center gap-4 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-kind-family-vivid to-kind-family p-5 text-white shadow-press"
      initial={{ opacity: 0, rotate: -3, y: 16 }}
      animate={{ opacity: 1, rotate: 0, y: 0 }}
      transition={spring.bouncy}
    >
      <Buddy buddy={child.buddy} size={96} mood="wave" interactive={false} track={false} />
      <div className="min-w-0">
        <p className="font-bold opacity-85">An invitation from</p>
        <p className="break-words font-display text-3xl font-semibold">{child.first_name}</p>
      </div>
      <HeartStraight weight="fill" aria-hidden className="absolute -right-3 -bottom-4 size-24 opacity-20" />
    </motion.div>
  )
}

function SignedOut({ child, inviteKey }: { child: InvitePreview; inviteKey: string }) {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Hello!</h1>
      <p className="text-lg text-muted-foreground">{child.first_name} would like you to follow along with their learning on Mentora.</p>
      <ChildBadge child={child} />
      <div className="grid gap-3">
        <Link to={`/signup/parent?invite=${encodeURIComponent(inviteKey)}`} className="block">
          <Button size="lg" className="h-auto min-h-14 w-full whitespace-normal bg-kind-family-vivid py-3 text-white">
            <UserPlus weight="bold" className="size-5 shrink-0" />
            Make my parent account
          </Button>
        </Link>
        <Link to="/signin" state={{ from: `/family/${inviteKey}` }} className="block">
          <Button size="lg" variant="outline" className="h-auto min-h-14 w-full whitespace-normal py-3">
            <SignIn weight="bold" className="size-5" />
            I already have an account
          </Button>
        </Link>
      </div>
    </div>
  )
}

function Connect({ child, inviteKey }: { child: InvitePreview; inviteKey: string }) {
  const [label, setLabel] = useState('Mum')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { toast } = useToast()

  async function connect() {
    setBusy(true)
    setError(null)
    try {
      await familyApi.connect(inviteKey, label)
      toast(`You're connected to ${child.first_name}!`, { tone: 'success', body: 'Everything they do shows up on your home page.' })
      navigate('/', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Connect to {child.first_name}?</h1>
      <ChildBadge child={child} />
      <LabelPicker value={label} onChange={setLabel} childName={child.first_name} />
      {error && <Alert>{error}</Alert>}
      <Button size="lg" className="w-full bg-kind-family-vivid text-white" onClick={() => void connect()} loading={busy} disabled={!label.trim()}>
        {!busy && <HeartStraight weight="fill" className="size-5" />}
        Connect
      </Button>
    </div>
  )
}

function NotAParent({ child }: { child: InvitePreview }) {
  return (
    <div className="space-y-6">
      <ChildBadge child={child} />
      <p className="text-muted-foreground">This invitation is for a parent's account. Sign out, then open the link again to make one.</p>
      <Link to="/">
        <Button variant="outline">Back home</Button>
      </Link>
    </div>
  )
}

function Dead({ message }: { message: string }) {
  return (
    <div className="space-y-5 text-center">
      <motion.div variants={pop} initial="hidden" animate="shown" className="mx-auto grid size-24 place-items-center rounded-[2rem] bg-muted text-muted-foreground">
        <LinkBreak weight="duotone" className="size-12" />
      </motion.div>
      <h1 className="font-display text-3xl font-semibold">That invitation didn't work</h1>
      <p className="text-muted-foreground">{message}</p>
      <Link to="/">
        <Button variant="outline">Go home</Button>
      </Link>
    </div>
  )
}
