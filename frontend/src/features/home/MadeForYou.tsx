/**
 * Practice made for this student from what they found hard in a shared set:
 * their buddy presents it, each card names the weak spots it works on, and
 * one tap starts it. Hidden when there is nothing made for them.
 */
import { motion } from 'motion/react'
import { ArrowRight, CheckCircle, Sparkle } from '@phosphor-icons/react'
import { ButtonLink } from '@/components/ui'
import { BuddyAvatar, profileOf } from '@/features/buddies'
import { lookOfKind } from '@/features/learning/kinds'
import type { MadeForYou as Made } from '@/features/play/api'
import { cn } from '@/lib/utils'
import { rise, stagger, useCalmMotion } from '@/motion'

export function MadeForYou({ items, buddy, className }: { items: Made[]; buddy: string | null | undefined; className?: string }) {
  const calm = useCalmMotion()
  if (items.length === 0) return null
  const name = profileOf(buddy).name
  return (
    <section className={cn('rounded-[1.75rem] border border-border bg-surface p-5 shadow-sm md:p-6', className)} aria-labelledby="made-for-you">
      <div className="flex items-center gap-3">
        <BuddyAvatar buddy={buddy} mood="cheer" size={48} />
        <div className="min-w-0">
          <h2 id="made-for-you" className="flex items-center gap-2 font-display text-2xl font-semibold">
            Made for you
            <motion.span animate={calm ? undefined : { rotate: [0, 20, -10, 0], scale: [1, 1.2, 1] }} transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.5 }}>
              <Sparkle weight="fill" className="size-5 text-star" aria-hidden />
            </motion.span>
          </h2>
          <p className="text-sm text-muted-foreground">{name} made these from the bits you found tricky. A few minutes each!</p>
        </div>
      </div>
      <motion.ul className={cn('mt-4 grid gap-3', items.length > 1 && 'sm:grid-cols-2')} variants={stagger(0.06)} initial="hidden" animate="shown">
        {items.map((item) => (
          <Card key={item.set_id} item={item} />
        ))}
      </motion.ul>
    </section>
  )
}

function Card({ item }: { item: Made }) {
  const look = lookOfKind(item.kind)
  return (
    <motion.li variants={rise} className={cn('flex flex-col gap-3 rounded-3xl p-4', look.soft)}>
      <div className="flex items-start gap-3">
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl shadow-press', look.hero)}>
          <look.Icon weight="duotone" className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 text-foreground">
          <p className="break-words font-display text-lg font-semibold leading-snug">{item.title}</p>
          <p className="text-sm text-muted-foreground">
            {look.label} · from {item.from_title}
          </p>
        </div>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Practises">
        {item.skills.map((skill) => (
          <li key={skill} className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-foreground shadow-sm">
            {skill}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        {item.done ? (
          <span className="inline-flex items-center gap-1 text-sm font-bold text-correct">
            <CheckCircle weight="fill" className="size-4" aria-hidden /> Done — nice!
          </span>
        ) : (
          <span className="text-sm font-bold text-muted-foreground">Ready when you are</span>
        )}
        <ButtonLink to={`/practice/${item.set_id}`} size="sm" variant={item.done ? 'outline' : 'sun'}>
          {item.done ? 'Go again' : 'Practise now'}
          <ArrowRight weight="bold" className="size-4" aria-hidden />
        </ButtonLink>
      </div>
    </motion.li>
  )
}
