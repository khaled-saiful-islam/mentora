/**
 * Messages between a parent and their child's teachers: the conversations
 * down the side, the open one beside them — one at a time below `lg`, where
 * the app's own sidebar leaves no room for two.
 * `/messages/:threadId` opens one; a draft can arrive in the route's state
 * from a button elsewhere ("Ask about this").
 */
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ChatsCircle, NotePencil } from '@phosphor-icons/react'
import { Alert, Button, Card, Skeleton } from '@/components/ui'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { useResource } from '@/hooks/useResource'
import { useAuth } from '@/lib/auth'
import { useLive } from '@/lib/bus'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { Page, rise, stagger } from '@/motion'
import { messagesApi, whoLine, type Thread } from './api'
import { NewConversation } from './NewConversation'
import { ThreadView } from './ThreadView'

/** A last message this short is shown whole in the list; a longer one is
 *  never cut — the row says who wrote and when instead. */
const PREVIEW_MAX = 90

export default function MessagesPage() {
  const { threadId } = useParams()
  const navigate = useNavigate()
  const draft = (useLocation().state as { draft?: string } | null)?.draft
  const inbox = useResource('messages-inbox', () => messagesApi.inbox())
  const [starting, setStarting] = useState(false)
  const parent = useAuth().user?.role === 'parent'
  useLive(['messages'], () => void inbox.reload())
  const threads = inbox.data?.threads ?? []
  const contacts = inbox.data?.contacts ?? []

  return (
    <Page className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <div className={cn('flex flex-wrap items-end gap-3', threadId && 'hidden lg:flex')}>
        <div className="min-w-[min(100%,16rem)] flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Messages</h1>
          <p className="mt-1 text-muted-foreground">
            {parent
              ? "Talk with your child's teachers about how they're doing, homework, and anything you'd like explained."
              : "Talk with your students' families about how they're doing, and what would help at home."}
          </p>
        </div>
        {contacts.length > 0 && (
          <Button onClick={() => setStarting(true)}>
            <NotePencil weight="bold" className="size-5" aria-hidden /> New message
          </Button>
        )}
      </div>

      {inbox.error && <Alert className="mt-6">{inbox.error}</Alert>}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(15rem,19rem)_1fr] xl:grid-cols-[minmax(16rem,22rem)_1fr]">
        <Card className={cn('overflow-hidden', threadId && 'hidden lg:block')}>
          {inbox.loading && !inbox.data ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          ) : threads.length === 0 ? (
            <NoThreads parent={parent} canStart={contacts.length > 0} onStart={() => setStarting(true)} />
          ) : (
            <ThreadList threads={threads} activeId={threadId} />
          )}
        </Card>

        <Card className={cn('h-[calc(100dvh-12rem)] min-h-[26rem] overflow-hidden lg:h-[min(46rem,calc(100dvh-13rem))]', !threadId && 'hidden lg:block')}>
          {threadId ? (
            <ThreadView key={threadId} threadId={threadId} draft={draft} onBack={() => navigate('/messages')} />
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-muted-foreground">
              <p>{threads.length ? 'Pick a conversation to read it.' : 'Your conversations will show here.'}</p>
            </div>
          )}
        </Card>
      </div>

      {starting && <NewConversation contacts={contacts} onClose={() => setStarting(false)} />}
    </Page>
  )
}

function ThreadList({ threads, activeId }: { threads: Thread[]; activeId?: string }) {
  return (
    <motion.ul className="divide-y divide-border" variants={stagger(0.04)} initial="hidden" animate="shown">
      {threads.map((thread) => {
        const on = thread.id === activeId
        return (
          <motion.li key={thread.id} variants={rise}>
            <Link
              to={`/messages/${thread.id}`}
              aria-current={on ? 'page' : undefined}
              className={cn('flex items-start gap-3 p-4 hover:bg-hover', on && 'bg-selected')}
            >
              <Avatar name={thread.contact.person_name} seed={thread.contact.person_id} className="size-11" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="min-w-0 flex-1 break-words font-bold">{thread.contact.person_name}</p>
                  {thread.last_message_at && <span className="text-xs text-muted-foreground">{timeAgo(thread.last_message_at)}</span>}
                </div>
                <p className="break-words text-sm text-muted-foreground">{whoLine(thread)}</p>
                <p className={cn('mt-1 break-words text-sm', thread.unread ? 'font-bold text-foreground' : 'text-muted-foreground')}>{previewOf(thread)}</p>
              </div>
              {thread.unread > 0 && (
                <span className="mt-1 grid min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground" aria-label={`${thread.unread} unread`}>
                  {thread.unread}
                </span>
              )}
            </Link>
          </motion.li>
        )
      })}
    </motion.ul>
  )
}

export function previewOf(thread: Thread): string {
  const last = thread.last
  if (!last) return 'No messages yet'
  const who = last.mine ? 'You' : thread.contact.person_name
  return last.body.length <= PREVIEW_MAX ? `${last.mine ? 'You: ' : ''}${last.body}` : `${who} sent a longer message`
}

function NoThreads({ parent, canStart, onStart }: { parent: boolean; canStart: boolean; onStart: () => void }) {
  return (
    <EmptyState
      className="py-10"
      art={
        <span className="grid size-16 place-items-center rounded-3xl bg-grape-100 text-grape-700 dark:bg-grape-700/30 dark:text-grape-100">
          <ChatsCircle weight="duotone" className="size-9" />
        </span>
      }
      title="No messages yet"
      body={
        canStart
          ? 'Start a conversation — it stays between the two of you.'
          : parent
            ? 'Once your child is in a class, you can write to their teacher here.'
            : "When a student's family connects to them, you can write to the family here."
      }
      action={canStart && <Button variant="outline" onClick={onStart}>New message</Button>}
    />
  )
}
