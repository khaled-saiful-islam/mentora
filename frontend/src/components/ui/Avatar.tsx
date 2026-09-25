import { cn } from '@/lib/utils'

const TONES = [
  'from-grape-400 to-grape-600 text-white',
  'from-sun-300 to-sun-400 text-grape-900',
  'from-mint-400 to-mint-700 text-white',
  'from-coral-400 to-coral-700 text-white',
  'from-sky-400 to-sky-700 text-white',
] as const

/** A stable colour per name, so the same child is the same colour everywhere. */
function toneOf(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return TONES[Math.abs(hash) % TONES.length]
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]
  return letters.toUpperCase()
}

export function Avatar({
  name,
  seed,
  className,
}: {
  name: string
  seed?: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br font-display text-sm font-semibold',
        toneOf(seed ?? name),
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
