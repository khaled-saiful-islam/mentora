/**
 * The box a message is written in. Enter sends and Shift+Enter starts a new
 * line, like every messaging app; the box grows with the message up to a
 * few lines, then scrolls. Near the server's limit it counts down.
 */
import { useEffect, useRef, useState } from 'react'
import { PaperPlaneRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { MAX_BODY } from './api'

const TALLEST_PX = 180
const COUNT_FROM = MAX_BODY - 200

export function Composer({
  onSend,
  initial = '',
  suggestions = [],
  placeholder,
}: {
  /** Resolves true once sent, so the box can clear. */
  onSend: (body: string) => Promise<boolean>
  initial?: string
  suggestions?: string[]
  placeholder: string
}) {
  const [draft, setDraft] = useState(initial)
  const [sending, setSending] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const text = draft.trim()
  const tooLong = draft.length > MAX_BODY

  useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    // scrollHeight leaves out the border; without it a one-line box is two
    // pixels short and shows a scrollbar.
    const full = el.scrollHeight + el.offsetHeight - el.clientHeight
    el.style.height = `${Math.min(full, TALLEST_PX)}px`
    el.style.overflowY = full > TALLEST_PX ? 'auto' : 'hidden'
  }, [draft])

  async function send() {
    if (!text || tooLong || sending) return
    setSending(true)
    const sent = await onSend(text)
    setSending(false)
    if (sent) setDraft('')
    box.current?.focus()
  }

  function use(line: string) {
    setDraft(line)
    box.current?.focus()
  }

  return (
    <div className="border-t border-border bg-surface p-3">
      {suggestions.length > 0 && !draft && (
        <div className="mb-2 flex flex-wrap gap-2">
          {suggestions.map((line) => (
            <button
              key={line}
              type="button"
              onClick={() => use(line)}
              className="rounded-full border border-border bg-muted/60 px-3 py-1.5 text-left text-sm font-bold hover:-translate-y-0.5 hover:border-hover-border hover:bg-hover"
            >
              {line}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Your message</span>
          <textarea
            ref={box}
            rows={1}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void send()
              }
            }}
            className="block w-full resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-base leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <button
          type="button"
          onClick={() => void send()}
          disabled={!text || tooLong || sending}
          aria-label="Send"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm hover:-translate-y-0.5 hover:brightness-110 disabled:translate-y-0 disabled:opacity-50"
        >
          <PaperPlaneRight weight="fill" className="size-5" aria-hidden />
        </button>
      </div>
      {draft.length > COUNT_FROM && (
        <p className={cn('mt-1.5 text-xs font-bold', tooLong ? 'text-destructive' : 'text-muted-foreground')} aria-live="polite">
          {tooLong ? `${draft.length - MAX_BODY} characters too long` : `${MAX_BODY - draft.length} characters left`}
        </p>
      )}
    </div>
  )
}
