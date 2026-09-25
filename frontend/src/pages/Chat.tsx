import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert } from '@/components/ui'
import { Composer, type ComposerHandle } from '@/components/chat/Composer'
import { MakeChips } from '@/components/make/MakeChips'
import { MakeRail } from '@/components/make/MakeRail'
import { inOrder, startWith, type Makeable } from '@/components/make/showcase'
import { MessageList } from '@/components/chat/MessageList'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { AttachmentError } from '@/components/chat/AttachmentError'
import { Suggestions } from '@/components/chat/Suggestions'
import { ShareDialog } from '@/components/chat/ShareDialog'
import { ArtifactPanel } from '@/components/artifacts/ArtifactPanel'
import { PanelHandle } from '@/components/artifacts/PanelHandle'
import { usePanelWidth } from '@/hooks/usePanelWidth'
import { useChat } from '@/hooks/useChat'
import { useConversations } from '@/hooks/useConversations'
import { useConfig } from '@/hooks/useConfig'
import { useMakeable } from '@/hooks/useMakeable'
import { LearnTiles } from '@/features/learning/LearnTiles'
import { ChatHeader } from '@/features/chat/ChatHeader'
import { ChatWelcome } from '@/features/chat/ChatWelcome'
import { profileOf } from '@/features/buddies'
import { useLearnStudio } from '@/features/learning/LearnStudio'
import { useDocuments } from '@/hooks/useDocuments'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { chatRoot } from '@/features/shell/nav'

export default function Chat() {
  const { conversationId: routeId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const list = useConversations()
  const config = useConfig()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const onConversationStarted = useCallback(
    (id: string, title: string) => {
      list.upsert(id, title)
      // Put the id in the URL without a navigation, so a reload or a shared
      // link lands on this conversation.
      window.history.replaceState(null, '', `/c/${id}`)
    },
    [list],
  )

  const chat = useChat(onConversationStarted)
  const { load, reset } = chat

  const activeConversationId = chat.conversationId ?? routeId ?? null
  const documents = useDocuments(activeConversationId, { images: config?.images_enabled ?? false })
  const [sharing, setSharing] = useState(false)
  const composer = useRef<ComposerHandle>(null)
  const makeable = useMakeable()
  const kinds: Makeable[] = useMemo(() => inOrder(makeable.studio), [makeable.studio])
  const studio = useLearnStudio()

  /** A kind picked from the rail or the chips: its request, ready to edit. */
  function start(kind: Makeable, example?: string) {
    const { text, selection } = startWith(kind, example)
    composer.current?.fill(text, selection)
  }

  useEffect(() => {
    setLoadError(null)
    if (!routeId) {
      reset()
      return
    }
    load(routeId).catch((error: Error) => setLoadError(error.message))
  }, [routeId, load, reset])

  function startNew() {
    reset()
    documents.reset()
    navigate(chatRoot(user))
    setMenuOpen(false)
  }

  /**
   * Attach a file, creating the conversation first if there is not one yet.
   *
   * A file belongs to a conversation, and someone can attach one before typing
   * anything — so the chat starts when the file does.
   */
  async function attach(file: File) {
    let target = activeConversationId
    if (!target) {
      try {
        const created = await apiFetch<{ id: string; title: string }>('/conversations', {
          method: 'POST',
        })
        target = created.id
        list.upsert(created.id, created.title)
        window.history.replaceState(null, '', `/c/${created.id}`)
        navigate(`/c/${created.id}`, { replace: true })
      } catch {
        return
      }
    }
    await documents.attach(file, target)
  }

  async function remove(id: string) {
    await list.remove(id)
    if (id === chat.conversationId || id === routeId) startNew()
  }

  const empty = chat.messages.length === 0
  // The build on the answer being written, so the panel can show it before
  // there is an artifact to show.
  const building = chat.messages[chat.messages.length - 1]?.building ?? null
  const panelOpen = !!chat.openArtifact || !!building
  const panel = usePanelWidth()

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        conversations={list.conversations}
        activeId={activeConversationId}
        loading={list.loading}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSelect={(id) => {
          navigate(`/c/${id}`)
          setMenuOpen(false)
        }}
        onNew={startNew}
        onRename={list.rename}
        onDelete={remove}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          title={empty ? '' : (chat.title ?? '')}
          conversationId={empty ? null : activeConversationId}
          totals={chat.totals}
          onMenu={() => setMenuOpen(true)}
          onShare={() => setSharing(true)}
        />

        {empty ? (
          <ChatWelcome onPick={(text) => void chat.send(text)}>
            {/* The studio artifacts, for staff: right at the top. */}
            {kinds.length > 0 && <MakeRail kinds={kinds} onPick={start} />}
            {/* What Mentora makes for learning, in the welcome rather than
                over the box, so the box stays small and the welcome breathes. */}
            <LearnTiles kinds={makeable.learning} onPick={studio.create} />
          </ChatWelcome>
        ) : (
          <MessageList
            messages={chat.messages}
            ratings={chat.ratings}
            currency={chat.currency}
            onRate={chat.rate}
            onRegenerate={chat.regenerate}
            openArtifact={chat.openArtifact}
            onOpenArtifact={chat.setOpenArtifact}
            footer={
              <Suggestions
                items={chat.suggestions}
                disabled={chat.streaming}
                onPick={(text) => void chat.send(text)}
              />
            }
          />
        )}

        {(loadError || chat.error) && (
          <div className="mx-auto w-full max-w-[var(--message-column)] px-4">
            <Alert>{loadError ?? chat.error}</Alert>
          </div>
        )}

        {documents.error && (
          <AttachmentError message={documents.error} onDismiss={documents.clearError} />
        )}

        <Composer
          ref={composer}
          above={
            empty ? null : (
              <>
                <LearnTiles compact kinds={makeable.learning} onPick={studio.create} />
                {kinds.length > 0 && <MakeChips kinds={kinds} hidden={chat.streaming} onPick={(kind) => start(kind)} />}
              </>
            )
          }
          onSend={(text, options) =>
            chat.send(text, {
              searchMode: options.searchMode,
              // What is on screen, so "make it warmer" has a subject.
              artifactId: chat.openArtifact,
              // The pending files become cards on this message, and leave the
              // composer — the server binds them to the same id.
              documents: documents.pending,
              onSent: documents.markSent,
            })
          }
          onStop={chat.stop}
          streaming={chat.streaming}
          searchEnabled={config?.search_enabled ?? false}
          imagesEnabled={config?.images_enabled ?? false}
          files={documents.pending}
          uploadingFile={documents.uploading}
          atFileLimit={documents.files.length >= documents.maxFiles}
          onAttach={attach}
          onRemoveFile={(id) => {
            if (activeConversationId) void documents.remove(id, activeConversationId)
          }}
          placeholder={user?.role === 'student' ? `Ask ${profileOf(user.buddy).name} anything…` : 'Ask, plan or make something…'}
          note={
            user?.role === 'student'
              ? `${profileOf(user.buddy).name} can make mistakes too — check big things with your teacher.`
              : 'Mentora can make mistakes. Check important information.'
          }
          autoFocus
        />
      </main>

      {panelOpen && (
        <>
          <PanelHandle
            dragging={panel.dragging}
            onStart={panel.startDragging}
            onReset={panel.reset}
          />
          <div
            className="flex shrink-0 border-l border-border"
            style={{ width: panel.width }}
          >
            <ArtifactPanel
              artifactId={chat.openArtifact}
              revision={chat.artifactRevision}
              build={building}
              onClose={() => chat.setOpenArtifact(null)}
            />
          </div>
        </>
      )}

      {sharing && activeConversationId && (
        <ShareDialog
          conversationId={activeConversationId}
          messageCount={chat.messages.length}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  )
}
