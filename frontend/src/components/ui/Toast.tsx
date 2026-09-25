import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react'
import { spring } from '@/motion'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'info' | 'error'

interface ToastItem {
  id: number
  tone: Tone
  title: string
  body?: string
}

interface ToastApi {
  toast: (title: string, options?: { tone?: Tone; body?: string; ms?: number }) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const TONES: Record<Tone, { Icon: typeof Info; ring: string; icon: string }> = {
  success: { Icon: CheckCircle, ring: 'border-correct/40', icon: 'text-correct' },
  info: { Icon: Info, ring: 'border-grape-300', icon: 'text-primary' },
  error: { Icon: WarningCircle, ring: 'border-destructive/40', icon: 'text-destructive' },
}

/** Small news that pops up and goes away on its own. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const next = useRef(1)

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), [])

  const toast = useCallback<ToastApi['toast']>(
    (title, { tone = 'success', body, ms = 4200 } = {}) => {
      const id = next.current++
      setItems((all) => [...all.slice(-3), { id, tone, title, body }])
      window.setTimeout(() => dismiss(id), ms)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])
  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        >
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const { Icon, ring, icon } = TONES[item.tone]
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 24, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: spring.bouncy }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                  role="status"
                  className={cn(
                    'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border-2 bg-surface px-4 py-3 shadow-lg',
                    ring,
                  )}
                >
                  <Icon weight="fill" className={cn('mt-0.5 size-6 shrink-0', icon)} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{item.title}</p>
                    {item.body && <p className="text-sm text-muted-foreground">{item.body}</p>}
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => dismiss(item.id)}
                    className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-hover"
                  >
                    <X weight="bold" className="size-4" />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}
