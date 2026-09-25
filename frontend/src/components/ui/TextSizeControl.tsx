import { motion } from 'motion/react'
import { spring } from '@/motion'
import { usePreferences } from '@/lib/prefs'
import { TEXT_SCALES, type TextScale } from '@/lib/user'
import { cn } from '@/lib/utils'

const LABELS: Record<TextScale, string> = {
  90: 'Small',
  100: 'Regular',
  115: 'Big',
  130: 'Bigger',
  150: 'Biggest',
}

/**
 * A− · · · · · A+ — the text size, anywhere text is read.
 *
 * One setting, saved to the account, so a student who needs big text gets it
 * on every device and in every quiz without asking twice. The indicator
 * slides between steps; the letters themselves grow with it.
 */
export function TextSizeControl({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { prefs, setPreference } = usePreferences()
  const index = Math.max(0, TEXT_SCALES.indexOf(prefs.text_scale))

  function step(to: number) {
    const next = TEXT_SCALES[Math.min(TEXT_SCALES.length - 1, Math.max(0, to))]
    if (next !== prefs.text_scale) void setPreference({ text_scale: next }).catch(() => {})
  }

  return (
    <div
      role="group"
      aria-label={`Text size: ${LABELS[prefs.text_scale]}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border-2 border-border bg-surface p-1',
        className,
      )}
    >
      <SizeButton label="Smaller text" disabled={index === 0} onClick={() => step(index - 1)}>
        <span className="text-[0.8rem]">A</span>
        <span aria-hidden className="text-[0.7rem]">−</span>
      </SizeButton>

      {!compact && (
        <div className="flex items-center gap-1 px-1" aria-hidden>
          {TEXT_SCALES.map((scale, i) => (
            <button
              key={scale}
              type="button"
              tabIndex={-1}
              onClick={() => step(i)}
              className="relative grid size-4 place-items-center"
            >
              <span className="size-1.5 rounded-full bg-border" />
              {i === index && (
                <motion.span
                  layoutId="text-size-dot"
                  transition={spring.snappy}
                  className="absolute size-3 rounded-full bg-primary"
                />
              )}
            </button>
          ))}
        </div>
      )}

      <SizeButton
        label="Bigger text"
        disabled={index === TEXT_SCALES.length - 1}
        onClick={() => step(index + 1)}
      >
        <span className="text-[1.1rem]">A</span>
        <span aria-hidden className="text-[0.8rem]">+</span>
      </SizeButton>
      <span className="sr-only" aria-live="polite">
        {LABELS[prefs.text_scale]} text
      </span>
    </div>
  )
}

function SizeButton({
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
      whileTap={{ scale: 0.88 }}
      className="inline-flex h-8 min-w-9 items-baseline justify-center gap-px rounded-full px-2 font-display font-bold leading-none text-foreground hover:bg-hover disabled:opacity-35"
    >
      {children}
    </motion.button>
  )
}
