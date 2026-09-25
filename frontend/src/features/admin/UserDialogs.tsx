import { Check, Copy, Warning } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Alert, Button, Field, Input, Skeleton } from '@/components/ui'
import { Dialog } from '@/components/ui/Dialog'
import { Segmented } from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { GradePicker } from '@/features/auth/GradePicker'
import type { Role } from '@/lib/user'
import { adminApi, nameOfUser, signInOf, type Footprint, type ManagedUser, type TemporaryPassword } from './api'

const nameOf = nameOfUser

/** A new temporary password, shown once with a copy button. */
export function PasswordDialog({ user, open, onClose }: { user: ManagedUser; open: boolean; onClose: () => void }) {
  const [result, setResult] = useState<TemporaryPassword | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setResult(null)
  }, [open])

  async function reset() {
    setBusy(true)
    setError(null)
    try {
      setResult(await adminApi.resetPassword(user.id))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Reset ${nameOf(user)}'s password`} description="Their old password stops working at once." size="sm"
      footer={result ? <Button onClick={onClose}>Done</Button> : (
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void reset()} loading={busy}>Make a new password</Button>
        </>
      )}
    >
      {error && <Alert>{error}</Alert>}
      {result && <PasswordReveal result={result} />}
    </Dialog>
  )
}

export function PasswordReveal({ result }: { result: TemporaryPassword }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-3">
      <p>
        Give this to <strong>{result.sign_in_name}</strong>. It is shown only once.
      </p>
      <div className="flex items-center gap-2 rounded-2xl bg-sun-100 p-3 dark:bg-sun-600/20">
        <code className="flex-1 font-mono text-xl font-bold tracking-wide">{result.password}</code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void navigator.clipboard?.writeText(result.password).then(() => setCopied(true))}
        >
          {copied ? <Check weight="bold" className="size-4" /> : <Copy weight="bold" className="size-4" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}

/** Delete, after showing what goes with it and having the name typed. */
export function DeleteUserDialog({ user, open, onClose, onDeleted }: { user: ManagedUser; open: boolean; onClose: () => void; onDeleted: () => void }) {
  const { toast } = useToast()
  const [footprint, setFootprint] = useState<Footprint | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const target = signInOf(user)

  useEffect(() => {
    if (!open) return
    setTyped('')
    setError(null)
    setFootprint(null)
    adminApi.footprint(user.id).then(setFootprint).catch((err) => setError(errorMessage(err)))
  }, [open, user.id])

  async function remove() {
    setBusy(true)
    try {
      await adminApi.remove(user.id, typed)
      toast(`${nameOf(user)} was deleted`, { tone: 'info' })
      onClose()
      onDeleted()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const goes = footprint
    ? [
        [footprint.classes, 'class', 'classes'],
        [footprint.students, 'student in those classes loses that work', 'students in those classes lose that work'],
        [footprint.learning_sets, 'quiz or flashcard set', 'quiz and flashcard sets'],
        [footprint.attempts, 'finished activity', 'finished activities'],
        [footprint.conversations, 'chat', 'chats'],
      ].filter(([n]) => Number(n) > 0)
    : []

  return (
    <Dialog open={open} onClose={onClose} title={`Delete ${nameOf(user)}?`} description="This cannot be undone." size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={typed.trim().toLowerCase() !== target.toLowerCase()} loading={busy} onClick={() => void remove()}>
            Delete for good
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {!footprint && !error ? (
          <Skeleton className="h-16 rounded-2xl" />
        ) : (
          <div className="flex gap-2 rounded-2xl bg-wrong-soft p-3">
            <Warning weight="fill" className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="text-sm">
              {goes.length === 0 ? (
                <p>Nothing else goes with this account.</p>
              ) : (
                <>
                  <p className="font-bold">This also deletes:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {goes.map(([n, one, many]) => (
                      <li key={String(one)}>{n} {Number(n) === 1 ? one : many}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
        <Field label={`Type ${target} to confirm`} htmlFor={`confirm-${user.id}`}>
          <Input id={`confirm-${user.id}`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
      </div>
    </Dialog>
  )
}

const ROLES = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' },
] as const

/** A new account, made by an admin — for a student who cannot sign up alone. */
export function CreateUserDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (user: ManagedUser) => void }) {
  const { toast } = useToast()
  const [role, setRole] = useState<Role>('student')
  const [name, setName] = useState('')
  const [login, setLogin] = useState('')
  const [grade, setGrade] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const student = role === 'student'

  useEffect(() => {
    if (open) (setName(''), setLogin(''), setGrade(''), setPassword(''), setError(null))
  }, [open])

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = await adminApi.create({
        role,
        display_name: name,
        password,
        ...(student ? { username: login, grade_level: grade } : { email: login }),
      })
      onCreated(user)
      toast(`${nameOf(user)} can sign in now`, { tone: 'success' })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New account" size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="new-account" loading={busy} disabled={!name || !login || password.length < 8 || (student && !grade)}>
            Create account
          </Button>
        </>
      }
    >
      <form id="new-account" className="space-y-4" onSubmit={(e) => void create(e)}>
        {error && <Alert>{error}</Alert>}
        <Segmented label="Role" value={role} onChange={(v) => setRole(v)} options={ROLES} />
        <Field label="Name" htmlFor="new-name">
          <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <Field label={student ? 'Username' : 'Email'} htmlFor="new-login" hint={student ? 'Students sign in with a username — no email needed.' : undefined}>
          <Input id="new-login" value={login} onChange={(e) => setLogin(e.target.value)} type={student ? 'text' : 'email'} autoComplete="off" />
        </Field>
        {student && (
          <div className="space-y-1.5">
            <p className="text-sm font-bold">Year or Form</p>
            <GradePicker value={grade} onChange={setGrade} />
          </div>
        )}
        <Field label="Password" htmlFor="new-password" hint="At least 8 characters. They can change it later.">
          <Input id="new-password" value={password} onChange={(e) => setPassword(e.target.value)} type="text" autoComplete="new-password" />
        </Field>
      </form>
    </Dialog>
  )
}
