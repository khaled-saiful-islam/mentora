import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from '@phosphor-icons/react'
import { spring } from '@/motion'
import { cn } from '@/lib/utils'

/**
 * A modal: a card that springs up on a desktop and a sheet that slides up on
 * a phone. Takes the keyboard while open, gives it back on close, and closes
 * on Escape or a tap outside.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <Panel onClose={onClose} title={title} description={description} footer={footer} size={size}>
          {children}
        </Panel>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Panel({
  onClose,
  title,
  description,
  children,
  footer,
  size,
}: {
  onClose: () => void
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size: 'sm' | 'md' | 'lg'
}) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const returnTo = useRef<Element | null>(null)

  useEffect(() => {
    returnTo.current = document.activeElement
    const first = panel.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-close]), [tabindex]:not([tabindex="-1"])',
    )
    ;(first ?? panel.current)?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') trapTab(event, panel.current)
    }
    window.addEventListener('keydown', onKey)
    const scrolled = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = scrolled
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        className="absolute inset-0 bg-grape-900/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-surface shadow-lg outline-none sm:rounded-[1.75rem]',
          { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[size],
        )}
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
        exit={{ opacity: 0, y: 30, scale: 0.98, transition: { duration: 0.15 } }}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-border sm:hidden" aria-hidden />
        <header className="flex items-start gap-3 px-6 pb-2 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-2xl font-semibold leading-tight">
              {title}
            </h2>
            {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground"
          >
            <X weight="bold" className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-raised/60 px-6 py-4">
            {footer}
          </footer>
        )}
      </motion.div>
    </div>
  )
}

/** Keep Tab inside the dialog: out of it is the page it is covering. */
function trapTab(event: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return
  const focusable = Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  )
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
