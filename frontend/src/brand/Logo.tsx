import { cn } from '@/lib/utils'

/**
 * The Mentora mark: an open book whose page tops draw an "M", with a spark of
 * sunshine above it — a book opening onto an idea.
 *
 * Inline rather than an <img> so the book inherits `currentColor` (grape on a
 * page, white on a tile) while the spark keeps its own sunshine. `twinkle`
 * lets the spark shimmer on loading and welcome screens; it is still under
 * reduced motion.
 */
export function LogoMark({
  className,
  accent = true,
  twinkle = false,
}: {
  className?: string
  accent?: boolean
  twinkle?: boolean
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      className={cn('shrink-0 overflow-visible', accent && 'text-primary', className)}
      fill="none"
    >
      <g stroke="currentColor" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 50V26c0-5 3.6-7.6 8.4-6.6 6.8 1.4 11.6 6 14.6 11.6 3-5.6 7.8-10.2 14.6-11.6 4.8-1 8.4 1.6 8.4 6.6v24" />
        <path d="M9 50c8.5-3.6 16.2-2.7 23 2 6.8-4.7 14.5-5.6 23-2" />
        <path d="M32 31v20" />
      </g>
      <path
        className={cn('logo-spark', twinkle && 'logo-spark-twinkle')}
        d="M32 1.5c1 5.4 3.9 8.3 9.3 9.3-5.4 1-8.3 3.9-9.3 9.3-1-5.4-3.9-8.3-9.3-9.3 5.4-1 8.3-3.9 9.3-9.3Z"
        style={{ fill: 'hsl(var(--sun-400))' }}
      />
    </svg>
  )
}

/** The mark on its grape tile — the app icon, drawn in the page. */
export function LogoTile({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-[28%] bg-gradient-to-br from-grape-400 to-grape-700 text-white shadow-press',
        className,
      )}
      aria-hidden
    >
      <LogoMark accent={false} className="size-[64%] translate-y-[4%]" />
    </span>
  )
}

/** Mark and name together, for headers and the sign-in screen. */
export function Wordmark({ className, tile = false }: { className?: string; tile?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {tile ? <LogoTile className="size-9" /> : <LogoMark className="size-8" />}
      <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Mentora
      </span>
    </span>
  )
}
