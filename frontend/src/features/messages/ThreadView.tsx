/**
 * One conversation: who it is with and which child it is about, the
 * messages by day, and the box to write in.
 *
 * Live: a push about this thread fetches the newest page and merges it in,
 * and while the page is in view anything new from the other side is marked
 * read — which also reads the bell's note about it.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, ChatsCircle } from '@phosphor-icons/react'
import { Alert, Button, Skeleton } from '@/components/ui'
import { Avatar } from '@/components/ui/Avatar'
import { errorMessage } from '@/features/auth/errors'
import { useResource } from '@/hooks/useResource'
import { useLive } from '@/lib/bus'
import { cn } from '@/lib/utils'
import { messagesApi, whoLine, type Message, type Thread } from './api'
import { Composer } from './Composer'
import { setUnread } from './unread'

const NEAR_BOTTOM_PX = 140

export function ThreadView({ threadId, draft, onBack }: { threadId: string; draft?: string; onBack: () => void }) {
  const thread = useResource(`pt-thread:${threadId}`, () => messagesApi.thread(threadId))
  const talk = useMessages(threadId)
  const view = thread.data

  if (thread.error) {
    return (
      <div className="p-6">
        <Alert tone="error">{thread.error}</Alert>
        <Button variant="outline" className="mt-4" onClick={onBack}>
          <ArrowLeft weight="bold" className="size-4" aria-hidden /> All messages
        </Button>
      </div>
    )
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      {view ? <Header thread={view} onBack={onBack} /> : <Skeleton className="m-4 h-12 rounded-2xl" />}
      <Messages talk={talk} thread={view} />
      {view && (
        <Composer
          key={threadId}
          initial={draft}
          onSend={talk.send}
          suggestions={talk.items.length === 0 && !talk.loading ? startersFor(view) : []}
          placeholder={`Write to ${view.contact.person_name}…`}
        />
      )}
    </div>
  )
}

function Header({ thread, onBack }: { thread: Thread; onBack: () => void }) {
  const c = thread.contact
  const link =
    thread.side === 'parent'
      ? { to: `/children/${c.student_id}/results`, label: `${firstName(c.student_name)}'s results` }
      : { to: `/classes/${c.class_ids[0]}`, label: c.class_names[0] }
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="All messages"
        className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-hover lg:hidden"
      >
        <ArrowLeft weight="bold" className="size-5" aria-hidden />
      </button>
      <Avatar name={c.person_name} seed={c.person_id} className="size-11" />
      <div className="min-w-[min(100%,12rem)] flex-1">
        <p className="break-words font-display text-lg font-semibold leading-tight">{c.person_name}</p>
        <p className="break-words text-sm text-muted-foreground">{whoLine(thread)}</p>
      </div>
      <Link to={link.to} className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
        <span className="break-words">{link.label}</span>
        <ArrowRight weight="bold" className="size-4 shrink-0" aria-hidden />
      </Link>
    </div>
  )
}

function Messages({ talk, thread }: { talk: Talk; thread: Thread | null }) {
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const lastId = talk.items.at(-1)?.id

  // Follow the newest message while the reader is at the bottom.
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [lastId, talk.loading])

  return (
    <div
      ref={scroller}
      onScroll={(e) => {
        const el = e.currentTarget
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
      }}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      aria-live="polite"
    >
      {talk.hasMore && (
        <div className="mb-3 text-center">
          <Button variant="outline" size="sm" onClick={() => void talk.loadOlder(scroller.current)}>
            Earlier messages
          </Button>
        </div>
      )}
      {talk.error && <Alert tone="error">{talk.error}</Alert>}
      {talk.loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-2/3 rounded-3xl" />
          <Skeleton className="ml-auto h-12 w-1/2 rounded-3xl" />
        </div>
      ) : talk.items.length === 0 ? (
        <Empty thread={thread} />
      ) : (
        <ol className="space-y-2">
          {talk.items.map((message, i) => (
            <li key={message.id}>
              {dayOf(message) !== dayOf(talk.items[i - 1]) && <DayMark iso={message.created_at} />}
              <Bubble message={message} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Bubble({ message }: { message: Message }) {
  const time = new Date(message.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className={cn('flex', message.mine ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[min(85%,34rem)] rounded-3xl px-4 py-2.5 shadow-sm',
          message.mine ? 'rounded-br-lg bg-bubble-user text-bubble-user-foreground' : 'rounded-bl-lg bg-muted text-foreground',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className={cn('mt-1 text-right text-xs', message.mine ? 'text-bubble-user-foreground/75' : 'text-muted-foreground')}>
          <span className="sr-only">{message.mine ? 'You, ' : ''}</span>
          {time}
        </p>
      </div>
    </motion.div>
  )
}

function DayMark({ iso }: { iso: string }) {
  return (
    <p className="my-3 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">
      <span className="rounded-full bg-muted px-3 py-1">{dayLabel(iso)}</span>
    </p>
  )
}

function Empty({ thread }: { thread: Thread | null }) {
  if (!thread) return null
  const c = thread.contact
  return (
    <div className="mx-auto max-w-sm py-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-grape-100 text-grape-700 dark:bg-grape-700/30 dark:text-grape-100" aria-hidden>
        <ChatsCircle weight="duotone" className="size-8" />
      </span>
      <p className="mt-3 font-display text-xl font-semibold">Say hello to {c.person_name}</p>
      <p className="mt-1 text-muted-foreground">
        {thread.side === 'parent'
          ? `Ask about how ${firstName(c.student_name)} is getting on, or anything you'd like explained.`
          : `Share how ${firstName(c.student_name)} is getting on, or ask for help at home.`}
      </p>
    </div>
  )
}

// --- the messages, live -----------------------------------------------------

interface Talk {
  items: Message[]
  hasMore: boolean
  loading: boolean
  error: string | null
  send: (body: string) => Promise<boolean>
  loadOlder: (scroller: HTMLDivElement | null) => Promise<void>
}

function useMessages(threadId: string): Talk {
  const [items, setItems] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const markRead = useCallback(() => {
    if (document.visibilityState !== 'visible') return
    messagesApi.read(threadId).then((reply) => setUnread(reply.unread), () => undefined)
  }, [threadId])

  const refresh = useCallback(
    async (first = false) => {
      try {
        const page = await messagesApi.messages(threadId)
        setItems((current) => merge(current, page.items))
        if (first) setHasMore(page.has_more)
        setError(null)
        if (first || page.items.some((m) => !m.mine)) markRead()
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setLoading(false)
      }
    },
    [threadId, markRead],
  )

  useEffect(() => {
    void refresh(true)
  }, [refresh])
  useLive(['messages'], (m) => {
    if (m.thread_id === threadId) void refresh()
  })
  useEffect(() => {
    const onShow = () => document.visibilityState === 'visible' && markRead()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [markRead])

  const send = useCallback(
    async (body: string) => {
      try {
        const sent = await messagesApi.send(threadId, body)
        setItems((current) => merge(current, [sent]))
        setError(null)
        return true
      } catch (e) {
        setError(errorMessage(e))
        return false
      }
    },
    [threadId],
  )

  const loadOlder = useCallback(
    async (scroller: HTMLDivElement | null) => {
      const oldest = items[0]
      if (!oldest) return
      const before = scroller?.scrollHeight ?? 0
      try {
        const page = await messagesApi.messages(threadId, oldest.id)
        setItems((current) => merge(page.items, current))
        setHasMore(page.has_more)
        // Keep the reader where they were, not jumped to the top.
        requestAnimationFrame(() => {
          if (scroller) scroller.scrollTop += scroller.scrollHeight - before
        })
      } catch (e) {
        setError(errorMessage(e))
      }
    },
    [items, threadId],
  )

  return { items, hasMore, loading, error, send, loadOlder }
}

/** Both lists, once each, oldest first. */
export function merge(a: Message[], b: Message[]): Message[] {
  const byId = new Map([...a, ...b].map((m) => [m.id, m] as const))
  return [...byId.values()].sort((x, y) => x.created_at.localeCompare(y.created_at))
}

// --- words ----------------------------------------------------------------

export function startersFor(thread: Thread): string[] {
  const child = firstName(thread.contact.student_name)
  return thread.side === 'parent'
    ? [`How is ${child} getting on in class?`, `Is there anything we can practise at home?`, `Could you explain what ${child} is learning this week?`]
    : [`${child} did really well this week!`, `Could you help ${child} practise at home?`, `Just checking in about how ${child} is doing.`]
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] || name
}

function dayOf(message: Message | undefined): string | null {
  return message ? new Date(message.created_at).toDateString() : null
}

export function dayLabel(iso: string, now: Date = new Date()): string {
  const day = new Date(iso)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (day.toDateString() === now.toDateString()) return 'Today'
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}
