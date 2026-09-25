/**
 * The bar over a chat. A student sees who they are talking to; staff see
 * the title, what the conversation cost, and ways to share or export it.
 *
 * Laid out by its own width, not the window's: with the sidebar and an
 * artifact open the chat column is narrow on a wide screen, and the buttons
 * used to push the title out and run into the panel beside it.
 */
import { DownloadSimple, LinkSimple, List } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { TextSizeControl } from '@/components/ui/TextSizeControl'
import { ConversationUsage } from '@/components/chat/Usage'
import { Buddy, profileOf } from '@/features/buddies'
import { useAuth } from '@/lib/auth'
import { can } from '@/lib/user'
import type { ComponentProps } from 'react'

type Totals = ComponentProps<typeof ConversationUsage>['totals']

export function ChatHeader({
  title,
  conversationId,
  totals,
  onMenu,
  onShare,
}: {
  title: string
  conversationId: string | null
  totals: Totals | null
  onMenu: () => void
  onShare: () => void
}) {
  const { user } = useAuth()
  const student = user?.role === 'student'
  const buddy = profileOf(user?.buddy)
  return (
    <header className="@container flex min-h-16 min-w-0 shrink-0 items-center justify-between gap-2 overflow-hidden py-2 border-b border-border/60 bg-background/80 px-2 backdrop-blur sm:gap-4 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onMenu} aria-label="Open menu" className="md:hidden">
          <List weight="bold" className="size-5" aria-hidden />
        </Button>
        {student && (
          <span className="-my-2 shrink-0">
            <Buddy buddy={user?.buddy} size={52} interactive={false} track={false} lively={false} />
          </span>
        )}
        <div className="min-w-0">
          <p className="line-clamp-3 break-words font-display text-sm font-semibold leading-tight @md:text-base" title={student ? undefined : title}>{student ? `Chat with ${buddy.name}` : title || 'New chat'}</p>
          <p className="text-xs text-muted-foreground">{student ? title || 'Your study buddy' : 'Studio'}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {totals && can(user, 'see_usage') && (
          <span className="hidden @2xl:inline-flex">
            <ConversationUsage totals={totals} />
          </span>
        )}
        {student && <TextSizeControl compact />}
        {conversationId && can(user, 'share_conversations') && (
          <Button variant="ghost" size="sm" onClick={onShare} title="Share a public link" aria-label="Share" className="px-3">
            <LinkSimple weight="bold" className="size-4" aria-hidden />
            <span className="hidden @lg:inline">Share</span>
          </Button>
        )}
        {conversationId && !student && (
          // A plain link: the browser already knows how to save a file the
          // server marked as an attachment.
          <a href={`/api/conversations/${conversationId}/export`} download title="Export as Markdown" aria-label="Export">
            <Button variant="ghost" size="sm" tabIndex={-1} className="px-3">
              <DownloadSimple weight="bold" className="size-4" aria-hidden />
              <span className="hidden @lg:inline">Export</span>
            </Button>
          </a>
        )}
      </div>
    </header>
  )
}
