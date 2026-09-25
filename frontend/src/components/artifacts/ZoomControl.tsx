import { AnimatePresence, motion } from 'motion/react'
import { MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react'
import { spring } from '@/motion'
import { cn } from '@/lib/utils'
import { stepZoom, ZOOM_STEPS, zoomLabel } from './zoom'

/**
 * − Fit + — how big the artifact is drawn, beside it.
 *
 * Its own setting rather than the account's text size: that one grows the
 * whole app, and a student squinting at a poster wants the poster bigger, not
 * the chat. The middle reads back where it is and, pressed, fits it again.
 */
export function ZoomControl({
  zoom,
  onZoom,
  className,
}: {
  zoom: number
  onZoom: (zoom: number) => void
  className?: string
}) {
  const smallest = zoom <= ZOOM_STEPS[0]
  const biggest = zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]
  const label = zoomLabel(zoom)

  return (
    <div
      role="group"
      aria-label={`Size: ${label}`}
      className={cn('inline-flex items-center rounded-full border-2 border-border bg-surface p-0.5', className)}
    >
      <Step label="Smaller" disabled={smallest} onClick={() => onZoom(stepZoom(zoom, -1))}>
        <MagnifyingGlassMinus weight="bold" className="size-4" aria-hidden />
      </Step>
      <button
        type="button"
        onClick={() => onZoom(1)}
        disabled={zoom === 1}
        title="Fit it to the panel"
        className="relative h-8 w-12 overflow-hidden rounded-full text-xs font-extrabold tabular-nums text-foreground hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent"
      >
        <AnimatePresence initial={false}>
          <motion.span
            key={label}
            className="absolute inset-0 grid place-items-center"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={spring.snappy}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </button>
      <Step label="Bigger" disabled={biggest} onClick={() => onZoom(stepZoom(zoom, 1))}>
        <MagnifyingGlassPlus weight="bold" className="size-4" aria-hidden />
      </Step>
      <span className="sr-only" aria-live="polite">
        {label}
      </span>
    </div>
  )
}

function Step({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: 0.85 }}
      className="grid size-8 place-items-center rounded-full text-foreground hover:bg-hover disabled:opacity-35"
    >
      {children}
    </motion.button>
  )
}
