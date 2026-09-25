/**
 * Everyone with an account: find them, suspend or restore them, reset a
 * forgotten password, cap what they spend, or — carefully — delete them.
 */
import { AnimatePresence, motion } from 'motion/react'
import { CaretDown, Key, MagnifyingGlass, Pause, Play, Plus, Trash } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Button, Chip, Input, Skeleton } from '@/components/ui'
import { Avatar } from '@/components/ui/Avatar'
import { Segmented } from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { useAuth } from '@/lib/auth'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { rise, stagger } from '@/motion'
import { adminApi, nameOfUser, signInOf, type ManagedUser } from './api'
import { CreateUserDialog, DeleteUserDialog, PasswordDialog } from './UserDialogs'

const ROLES = [
  { value: '', label: 'Everyone' },
  { value: 'student', label: 'Students' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'admin', label: 'Admins' },
] as const

const STATUSES = [
  { value: '', label: 'Any' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
] as const

type RoleFilter = (typeof ROLES)[number]['value']
type StatusFilter = (typeof STATUSES)[number]['value']

export function UsersTab() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const role = (params.get('role') ?? '') as RoleFilter
  const status = (params.get('status') ?? '') as StatusFilter
  const [items, setItems] = useState<ManagedUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(q), 300)
    return () => window.clearTimeout(timer)
  }, [q])

  useEffect(() => {
    let current = true
    setLoading(true)
    adminApi
      .users({ q: search, role, status })
      .then((page) => current && (setItems(page.items), setTotal(page.total), setError(null)))
      .catch((err) => current && setError(errorMessage(err)))
      .finally(() => current && setLoading(false))
    return () => {
      current = false
    }
  }, [search, role, status])

  async function more() {
    const page = await adminApi.users({ q: search, role, status, offset: items.length })
    setItems((now) => [...now, ...page.items.filter((u) => !now.some((n) => n.id === u.id))])
  }

  const setFilter = (key: 'role' | 'status', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">Search people</span>
          <MagnifyingGlass weight="bold" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, username or email" className="pl-10" />
        </label>
        <Button onClick={() => setCreating(true)}>
          <Plus weight="bold" className="size-4" />
          New account
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <Segmented label="Role" value={role} onChange={(v) => setFilter('role', v)} options={ROLES} />
        <Segmented label="Status" value={status} onChange={(v) => setFilter('status', v)} options={STATUSES} />
      </div>

      {error && <Alert className="mt-4">{error}</Alert>}
      <p className="mt-4 text-sm font-bold text-muted-foreground">{loading ? 'Looking…' : `${total} ${total === 1 ? 'person' : 'people'}`}</p>
      {loading && items.length === 0 ? (
        <div className="mt-2 space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : (
        <motion.ul className="mt-2 space-y-2" variants={stagger(0.03)} initial="hidden" animate="shown">
          {items.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onChange={(next) => setItems((now) => now.map((u) => (u.id === next.id ? next : u)))}
              onDeleted={() => (setItems((now) => now.filter((u) => u.id !== user.id)), setTotal((t) => t - 1))}
            />
          ))}
        </motion.ul>
      )}
      {items.length < total && !loading && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => void more()}>
            Show more
          </Button>
        </div>
      )}
      <CreateUserDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(user) => (setItems((now) => [user, ...now]), setTotal((t) => t + 1))}
      />
    </div>
  )
}

function UserRow({ user, onChange, onDeleted }: { user: ManagedUser; onChange: (u: ManagedUser) => void; onDeleted: () => void }) {
  const { user: me } = useAuth()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const self = me?.id === user.id

  async function patch(body: Record<string, unknown>, done: string) {
    try {
      onChange(await adminApi.update(user.id, body))
      toast(done, { tone: 'success' })
    } catch (error) {
      toast('That did not save', { tone: 'error', body: errorMessage(error) })
    }
  }

  return (
    <motion.li variants={rise} layout className={cn('rounded-2xl border-2 bg-surface', user.is_active ? 'border-border' : 'border-dashed border-border opacity-80')}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <Avatar name={nameOfUser(user)} seed={user.id} className="size-10" />
        <span className="min-w-0 flex-1">
          <span className="block break-words font-bold">
            {nameOfUser(user)}
            {self && <span className="ml-2 text-sm font-normal text-muted-foreground">(you)</span>}
          </span>
          <span className="block break-words text-sm text-muted-foreground">{signInOf(user)}</span>
        </span>
        <span className="hidden flex-wrap justify-end gap-1.5 sm:flex">
          <Chip tone={user.role === 'admin' ? 'grape' : user.role === 'teacher' ? 'sky' : 'sun'} className="capitalize">{user.role}</Chip>
          {!user.is_active && <Chip tone="coral">Suspended</Chip>}
        </span>
        <CaretDown weight="bold" className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Joined {timeAgo(user.created_at)} · {user.tokens_used_24h.toLocaleString()} tokens in 24 hours ·{' '}
                {user.daily_token_limit === null ? 'no limit' : `limit ${user.daily_token_limit.toLocaleString()}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setResetting(true)} disabled={self}>
                  <Key weight="bold" className="size-4" />
                  Reset password
                </Button>
                {user.is_active ? (
                  <Button size="sm" variant="outline" disabled={self} onClick={() => void patch({ is_active: false }, `${nameOfUser(user)} is suspended`)}>
                    <Pause weight="bold" className="size-4" />
                    Suspend
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void patch({ is_active: true }, `${nameOfUser(user)} can sign in again`)}>
                    <Play weight="bold" className="size-4" />
                    Restore
                  </Button>
                )}
                <LimitForm user={user} onSave={(body) => void patch(body, 'Limit saved')} />
                <Button size="sm" variant="ghost" className="ml-auto text-destructive" disabled={self} onClick={() => setDeleting(true)}>
                  <Trash weight="bold" className="size-4" />
                  Delete
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <PasswordDialog user={user} open={resetting} onClose={() => setResetting(false)} />
      <DeleteUserDialog user={user} open={deleting} onClose={() => setDeleting(false)} onDeleted={onDeleted} />
    </motion.li>
  )
}

function LimitForm({ user, onSave }: { user: ManagedUser; onSave: (body: Record<string, unknown>) => void }) {
  const [value, setValue] = useState(user.daily_token_limit?.toString() ?? '')
  const parsed = value.trim() === '' ? null : Number(value)
  const valid = parsed === null || (Number.isInteger(parsed) && parsed >= 0)
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) onSave(parsed === null ? { clear_limit: true } : { daily_token_limit: parsed })
      }}
    >
      <label className="sr-only" htmlFor={`limit-${user.id}`}>Daily token limit</label>
      <Input id={`limit-${user.id}`} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="No limit" className="h-9 w-32" />
      <Button size="sm" variant="secondary" type="submit" disabled={!valid}>Set limit</Button>
    </form>
  )
}
