import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { WarningCircle } from '@phosphor-icons/react'
import { LogoMark } from '@/brand/Logo'
import { ArtifactCard } from '@/components/artifacts/ArtifactCard'
import { BuddyAvatar, profileOf } from '@/features/buddies'
import type { ChatMessage, Rating } from '@/hooks/useChat'
import { useAuth } from '@/lib/auth'
import { can } from '@/lib/user'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { MessageAttachments } from './Attachments'
import { GuardBanner } from './GuardBanner'
import { ImageGrid } from './ImageGrid'
import { Markdown } from './Markdown'
import { MessageActions } from './MessageActions'
import { Sources } from './Sources'
import { ToolActivityList } from './ToolActivity'
import { MessageUsage } from './Usage'

export function MessageList({
  messages,
  ratings,
  currency,
  onRate,
  onRegenerate,
  openArtifact,
  onOpenArtifact,
  footer,
}: {
  messages: ChatMessage[]
  ratings: Record<string, Rating>
  currency: string
  onRate: (messageId: string, rating: Rating | null, reason?: string) => void
  onRegenerate: (messageId: string) => void
  openArtifact?: string | null
  onOpenArtifact?: (artifactId: string | null) => void
  /** Rendered after the last message — follow-up chips live here. */
  footer?: React.ReactNode
}) {
  const bottom = useRef<HTMLDivElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  // Follow the stream, but stop following the moment the reader scrolls up —
  // yanking someone back to the bottom while they are reading is worse than
  // making them scroll down themselves.
  useEffect(() => {
    const el = container.current
    if (!el) return
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      pinned.current = distance < 80
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (pinned.current) bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  return (
    <div ref={container} className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[var(--message-column)] px-4 py-8">
        <div className="space-y-8">
          {messages.map((message, index) => (
            <MessageRow
              key={message.id}
              message={message}
              rating={ratings[message.id] ?? null}
              currency={currency}
              // Only the latest answer can be regenerated: redoing an earlier
              // one would orphan every exchange after it.
              canRegenerate={index === messages.length - 1 && message.role === 'assistant'}
              onRate={onRate}
              onRegenerate={onRegenerate}
              openArtifact={openArtifact}
              onOpenArtifact={onOpenArtifact}
            />
          ))}
        </div>
        <div className="pl-12">{footer}</div>
        <div ref={bottom} className="h-px" />
      </div>
    </div>
  )
}

/** Who is answering: a student's own buddy, or Mentora's mark. */
export function Speaker({ size = 36, className }: { size?: number; className?: string }) {
  const { user } = useAuth()
  if (user?.role === 'student') return <BuddyAvatar buddy={user.buddy} size={size} className={className} />
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full bg-grape-100 dark:bg-grape-800/40', className)} style={{ width: size, height: size }}>
      <LogoMark className="size-[70%]" />
    </span>
  )
}

function MessageRow({
  message,
  rating,
  currency,
  canRegenerate,
  onRate,
  onRegenerate,
  openArtifact,
  onOpenArtifact,
}: {
  message: ChatMessage
  rating: Rating | null
  currency: string
  canRegenerate: boolean
  onRate: (messageId: string, rating: Rating | null, reason?: string) => void
  onRegenerate: (messageId: string) => void
  openArtifact?: string | null
  onOpenArtifact?: (artifactId: string | null) => void
}) {
  const { user } = useAuth()
  if (message.role === 'user') {
    return (
      <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring.snappy}>
        {message.documents && message.documents.length > 0 && <MessageAttachments files={message.documents} />}
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-gradient-to-br from-grape-500 to-grape-700 px-5 py-3 text-white shadow-sm">
            <p className="text-base leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      </motion.div>
    )
  }

  const waiting = message.streaming && message.content.length === 0
  return (
    <motion.div className="group/message flex gap-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.gentle}>
      <Speaker className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {message.guards && message.guards.length > 0 && <GuardBanner alerts={message.guards} />}
        {message.tools && message.tools.length > 0 && <ToolActivityList activities={message.tools} />}
        {message.images && message.images.length > 0 && <ImageGrid images={message.images} />}
        {message.building && <ArtifactCard build={message.building} onOpen={() => onOpenArtifact?.(null)} />}
        {message.artifacts?.map((artifact) => (
          <ArtifactCard key={artifact.id} artifact={artifact} active={openArtifact === artifact.id} onOpen={() => onOpenArtifact?.(artifact.id)} />
        ))}

        {waiting ? (
          <Working />
        ) : (
          <div className={cn('min-w-0', message.streaming && 'streaming-caret')}>
            <Markdown content={message.content} sources={message.sources ?? []} />
          </div>
        )}

        {message.sources && message.sources.length > 0 && <Sources sources={message.sources} />}
        {message.finish_reason === 'stopped' && <p className="mt-2 text-sm text-muted-foreground">Stopped by you.</p>}
        {message.error && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-destructive">
            <WarningCircle weight="bold" className="size-4" aria-hidden />
            {message.error}
          </p>
        )}

        {!message.streaming && message.content.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3">
            <MessageActions
              content={message.content}
              rating={rating}
              canRegenerate={canRegenerate}
              onRate={(next, reason) => onRate(message.id, next, reason)}
              onRegenerate={() => onRegenerate(message.id)}
            />
            {can(user, 'see_usage') && (
              <MessageUsage message={message} currency={currency} className="reveal-on-hover opacity-0 transition-opacity group-hover/message:opacity-100" />
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/** Between sending and the first word: a thinking bubble — with the student's
 *  buddy's name on it, so it is clear who is working on it. */
function Working() {
  const { user } = useAuth()
  const who = user?.role === 'student' ? profileOf(user.buddy).name : 'Mentora'
  return (
    <div className="inline-flex items-center gap-2.5 rounded-3xl rounded-tl-lg bg-surface-raised px-4 py-3" role="status" aria-live="polite">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-2 rounded-full bg-primary"
            animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </span>
      <span className="text-sm font-bold text-muted-foreground">{who} is thinking…</span>
    </div>
  )
}
