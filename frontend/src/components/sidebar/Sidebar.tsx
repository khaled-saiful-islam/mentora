import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { Button, Spinner } from '@/components/ui'
import { Confirm } from '@/components/ui/Confirm'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { nameOf } from '@/lib/user'
import { Avatar } from '@/components/ui/Avatar'
import { Wordmark } from '@/brand/Logo'
import { Bell } from '@/features/notifications/Bell'
import { navFor } from '@/features/shell/nav'
import type { ConversationSummary } from '@/hooks/useConversations'
import { Check, DotsThree, GearSix, NotePencil, SidebarSimple, SignOut, Trash, User, UserGear, X } from '@phosphor-icons/react'

/** Buckets by recency, the way every chat sidebar people already know does. */
export function groupByRecency(
  conversations: ConversationSummary[],
  now: Date = new Date(),
): [string, ConversationSummary[]][] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const day = 86_400_000

  const buckets: Record<string, ConversationSummary[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 days': [],
    'Previous 30 days': [],
    Older: [],
  }

  for (const conversation of conversations) {
    const at = new Date(conversation.updated_at).getTime()
    if (at >= startOfToday) buckets.Today.push(conversation)
    else if (at >= startOfToday - day) buckets.Yesterday.push(conversation)
    else if (at >= startOfToday - 7 * day) buckets['Previous 7 days'].push(conversation)
    else if (at >= startOfToday - 30 * day) buckets['Previous 30 days'].push(conversation)
    else buckets.Older.push(conversation)
  }

  return Object.entries(buckets).filter(([, items]) => items.length > 0)
}

export function Sidebar({
  conversations,
  activeId,
  loading,
  open,
  onClose,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: {
  conversations: ConversationSummary[]
  activeId: string | null
  loading: boolean
  /** Drawer state. Ignored from `md` up, where the sidebar is always present. */
  open: boolean
  onClose: () => void
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}) {
  const { user, signOut } = useAuth()
  const groups = groupByRecency(conversations)
  // Held here rather than in the row, so the dialog is not inside the thing it
  // is about to remove.
  const [confirming, setConfirming] = useState<ConversationSummary | null>(null)
  // Folded to a rail of icons, from md up. On a phone the sidebar is a drawer
  // already, and folding a drawer would only hide the button that opens it.
  const [folded, setFolded] = useFolded()

  // Escape closes the drawer. Expected of anything that covers the page, and
  // the only way out for someone not using a pointer.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      {/* Scrim, mobile only. */}
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          'fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[2px] transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={cn(
          'flex h-dvh w-[var(--sidebar-width)] shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar',
          // Off-canvas below md, static from md up.
          'fixed inset-y-0 left-0 z-40 md:static md:translate-x-0',
          'transition-[transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          open ? 'translate-x-0 shadow-lg' : '-translate-x-full',
          folded && 'md:w-[3.75rem]',
        )}
      >
      {folded && (
        <Rail
          onUnfold={() => setFolded(false)}
          onNew={onNew}
          admin={!!user?.is_admin}
          onSignOut={signOut}
        />
      )}

      <div className={cn('flex items-center justify-between px-4 pt-4', folded && 'md:hidden')}>
        <Link to="/" aria-label="Mentora home">
          <Wordmark tile />
        </Link>
      </div>
      <div className={cn('flex items-center gap-1 p-3', folded && 'md:hidden')}>
        <button
          type="button"
          onClick={onNew}
          className={cn(
            'flex w-full items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 font-bold text-primary-foreground shadow-press',
            'transition-[transform,box-shadow,filter] hover:brightness-110 active:translate-y-0.5 active:shadow-none',
          )}
        >
          <NotePencil weight="bold" className="size-5" aria-hidden />
          New chat
        </button>

        <Bell />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setFolded(true)}
          aria-label="Minimise the sidebar"
          title="Minimise the sidebar"
          className="hidden shrink-0 md:inline-flex"
        >
          <SidebarSimple weight="bold" className="size-4" aria-hidden />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close menu"
          className="md:hidden"
        >
          <X weight="bold" className="size-4" aria-hidden />
        </Button>
      </div>

      <PlacesNav folded={folded} />

      <nav
        className={cn('flex-1 overflow-y-auto px-2 pb-2', folded && 'md:hidden')}
        aria-label="Conversation history"
      >
        {loading && conversations.length === 0 && (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No conversations yet.
          </p>
        )}

        {groups.map(([label, items]) => (
          <div key={label} className="mb-3">
            <h2 className="px-3 py-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">{label}</h2>
            <ul className="space-y-0.5">
              {items.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === activeId}
                  onSelect={onSelect}
                  onRename={onRename}
                  onDelete={() => setConfirming(conversation)}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn('p-3', folded && 'md:hidden')}>
        <div className="flex items-center gap-2 rounded-2xl bg-surface p-2 shadow-sm">
          <Link to="/profile" className="flex min-w-0 flex-1 items-center gap-2">
            <Avatar name={user ? nameOf(user) : '?'} seed={user?.id ?? ''} className="size-9" />
            <span className="min-w-0">
              <span className="block break-words text-sm font-bold">{user ? nameOf(user) : ''}</span>
              <span className="block break-words text-xs capitalize text-muted-foreground">
                {user?.role === 'student' && user.grade_label ? user.grade_label : user?.role}
              </span>
            </span>
          </Link>
          <Link to="/settings" aria-label="Settings" title="Settings" className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground">
            <GearSix weight="bold" className="size-5" aria-hidden />
          </Link>
          <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out" className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground">
            <SignOut weight="bold" className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      </aside>

      {/* Deleting a chat takes the messages, the files and anything made in it
          with it, and there is no undo. Naming it is the point: a dialog that
          only says "are you sure?" asks a question nobody can answer. */}
      {confirming && (
        <Confirm
          title="Delete this chat?"
          body={
            <>
              <span className="font-medium text-foreground">{confirming.title}</span> and
              everything in it — the messages, the files, anything it made — will be gone.
              This cannot be undone.
            </>
          }
          confirmLabel="Delete chat"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const doomed = confirming
            setConfirming(null)
            onDelete(doomed.id)
          }}
        />
      )}
    </>
  )
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  conversation: ConversationSummary
  active: boolean
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  /** Chosen from the row's menu. What actually happens is asked about first. */
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conversation.title)
  const [menuOpen, setMenuOpen] = useState(false)

  function commit() {
    const title = draft.trim()
    if (title && title !== conversation.title) onRename(conversation.id, title)
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="flex items-center gap-1 rounded-lg bg-surface px-2 py-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          aria-label="Conversation title"
          className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
        />
        <button type="button" onClick={commit} aria-label="Save title" className="p-1">
          <Check weight="bold" className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancel rename"
          className="p-1"
        >
          <X weight="bold" className="size-3.5" aria-hidden />
        </button>
      </li>
    )
  }

  return (
    <li className="group/row relative">
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className={cn(
          'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors',
          active
            ? 'bg-grape-100 font-bold text-grape-800 dark:bg-grape-800/40 dark:text-grape-100'
            : 'font-semibold text-sidebar-foreground hover:bg-hover',
        )}
      >
        <span className="break-words pr-6">{conversation.title}</span>
      </button>

      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label={`Actions for ${conversation.title}`}
        aria-expanded={menuOpen}
        className={cn(
          'reveal-on-hover absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 transition-opacity',
          'opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100',
          menuOpen && 'opacity-100',
        )}
      >
        <DotsThree weight="bold" className="size-4" aria-hidden />
      </button>

      {menuOpen && (
        <>
          {/* Click-away layer: a menu you cannot dismiss by clicking elsewhere
              is the kind of thing people notice immediately. */}
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="absolute right-1 top-9 z-20 w-40 overflow-hidden rounded-2xl border border-border bg-surface py-1.5 shadow-lg">
            <MenuItem
              onClick={() => {
                setDraft(conversation.title)
                setEditing(true)
                setMenuOpen(false)
              }}
            >
              <NotePencil weight="bold" className="size-3.5" aria-hidden />
              Rename
            </MenuItem>
            <MenuItem
              destructive
              onClick={() => {
                setMenuOpen(false)
                onDelete()
              }}
            >
              <Trash weight="bold" className="size-3.5" aria-hidden />
              Delete
            </MenuItem>
          </div>
        </>
      )}
    </li>
  )
}

function MenuItem({
  children,
  onClick,
  destructive,
}: {
  children: React.ReactNode
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-hover',
        destructive && 'text-destructive',
      )}
    >
      {children}
    </button>
  )
}

const FOLDED_KEY = 'mentora-sidebar-folded'

/** Remembered, because a sidebar that springs back open on every reload is
 *  one somebody has to fold again every time. */
function useFolded(): [boolean, (folded: boolean) => void] {
  const [folded, setFolded] = useState(() => {
    try {
      return localStorage.getItem(FOLDED_KEY) === '1'
    } catch {
      return false
    }
  })
  const set = (next: boolean) => {
    setFolded(next)
    try {
      localStorage.setItem(FOLDED_KEY, next ? '1' : '0')
    } catch {
      // Private windows: it folds for this visit and forgets.
    }
  }
  return [folded, set]
}

/**
 * The sidebar folded down to what is needed without it: a way back, a new
 * chat, and the account. The conversation list is the part that takes room,
 * and it is one click away.
 */
function Rail({
  onUnfold,
  onNew,
  admin,
  onSignOut,
}: {
  onUnfold: () => void
  onNew: () => void
  admin: boolean
  onSignOut: () => void
}) {
  return (
    <div className="hidden h-full flex-col items-center gap-1 py-3 md:flex">
      <RailButton label="Open the sidebar" onClick={onUnfold}>
        <SidebarSimple weight="bold" className="size-4" aria-hidden />
      </RailButton>
      <RailButton label="New chat" onClick={onNew} strong>
        <NotePencil weight="bold" className="size-4" aria-hidden />
      </RailButton>
      <Bell />

      <div className="mt-auto flex flex-col items-center gap-1">
        <Link to="/profile" aria-label="Profile" title="Profile">
          <RailButton label="Profile">
            <User weight="bold" className="size-4" aria-hidden />
          </RailButton>
        </Link>
        {admin && (
          <Link to="/admin" aria-label="Users" title="Users">
            <RailButton label="Users">
              <UserGear weight="bold" className="size-4" aria-hidden />
            </RailButton>
          </Link>
        )}
        <Link to="/settings" aria-label="GearSix" title="GearSix">
          <RailButton label="GearSix">
            <GearSix weight="bold" className="size-4" aria-hidden />
          </RailButton>
        </Link>
        <RailButton label="Sign out" onClick={onSignOut}>
          <SignOut weight="bold" className="size-4" aria-hidden />
        </RailButton>
      </div>
    </div>
  )
}

function RailButton({
  label,
  onClick,
  strong,
  children,
}: {
  label: string
  onClick?: () => void
  strong?: boolean
  children: React.ReactNode
}) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick, 'aria-label': label } : {})}
      title={label}
      className={cn(
        'grid size-9 place-items-center rounded-lg transition-colors',
        strong
          ? 'border border-border bg-surface shadow-sm hover:border-hover-border hover:bg-hover'
          : 'text-muted-foreground hover:bg-hover hover:text-foreground',
      )}
    >
      {children}
    </Tag>
  )
}

/**
 * The other places in Mentora, from the same table as the rest of the app's
 * navigation — so a page added for a role shows up here too.
 */
function PlacesNav({ folded }: { folded: boolean }) {
  const { user } = useAuth()
  const places = navFor(user).filter((item) => item.key !== 'studio' && item.key !== 'chat' && item.key !== 'settings')
  // The chat's own sidebar leads out to the rest of Mentora.
  if (places.length === 0) return null
  return (
    <div className={cn('px-3 pb-2', folded && 'md:hidden')}>
      {places.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 font-bold text-sidebar-foreground transition-colors hover:bg-hover"
        >
          <item.Icon weight="duotone" className="size-5 text-primary" />
          {item.label}
        </Link>
      ))}
    </div>
  )
}

