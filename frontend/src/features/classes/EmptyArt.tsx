import type { Icon } from '@phosphor-icons/react'
import { Sparkle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

/** A big friendly icon on a soft blob, with sparkles — for empty states. */
export function EmptyArt({ Icon, tone = 'from-grape-200 to-sun-100' }: { Icon: Icon; tone?: string }) {
  return (
    <div className="relative grid size-32 place-items-center" aria-hidden>
      <span className={cn('absolute inset-2 rounded-[2.5rem] bg-gradient-to-br rotate-6', tone)} />
      <Icon weight="duotone" className="relative size-16 text-primary" />
      <Sparkle weight="fill" className="absolute right-1 top-2 size-6 text-sun-400" />
      <Sparkle weight="fill" className="absolute bottom-3 left-1 size-4 text-coral-400" />
    </div>
  )
}
