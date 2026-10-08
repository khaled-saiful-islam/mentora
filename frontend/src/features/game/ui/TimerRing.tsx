/** How long is left, as a ring that empties — and turns coral near the end. */
import { cn } from '@/lib/utils'

export function TimerRing({ left, seconds, className }: { left: number; seconds: number; className?: string }) {
  const r = 20
  const around = 2 * Math.PI * r
  const urgent = left * seconds <= 5
  return (
    <div className={cn('relative grid size-14 shrink-0 place-items-center', className)} role="timer" aria-label={`${Math.ceil(left * seconds)} seconds left`}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="hsl(var(--surface))" stroke="hsl(var(--border))" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={urgent ? 'hsl(var(--wrong))' : 'hsl(var(--star))'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={around}
          strokeDashoffset={around * (1 - left)}
        />
      </svg>
      <span className={cn('relative font-display text-lg font-bold tabular-nums', urgent && 'text-destructive')}>{Math.ceil(left * seconds)}</span>
    </div>
  )
}
