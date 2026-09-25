/**
 * A student's trophy shelf: the badges they have, shining, and the ones
 * still to earn as silhouettes with a hint of how.
 */
import { motion } from 'motion/react'
import { Alert, Skeleton } from '@/components/ui'
import { playApi } from '@/features/play/api'
import { useResource } from '@/hooks/useResource'
import { cn } from '@/lib/utils'
import { Page, pop, stagger } from '@/motion'
import { BadgeMedal } from './medals'

export default function BadgesPage() {
  const badges = useResource('my-badges', () => playApi.badges())
  const data = badges.data
  const earnedKeys = new Set(data?.earned.map((b) => b.badge) ?? [])
  const counts = new Map<string, number>()
  data?.earned.forEach((b) => counts.set(b.badge, (counts.get(b.badge) ?? 0) + 1))
  const toEarn = data?.catalog.filter((b) => !earnedKeys.has(b.badge)) ?? []
  const shelf = data?.catalog.filter((b) => earnedKeys.has(b.badge)) ?? []

  return (
    <Page className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">My badges</h1>
      <p className="mt-1 text-muted-foreground">
        {data ? `${shelf.length} of ${data.catalog.length} collected` : 'Collect them all!'}
      </p>
      {badges.error && <Alert className="mt-6">{badges.error}</Alert>}
      {!data ? (
        <Skeleton className="mt-8 h-64 rounded-[2rem]" />
      ) : (
        <>
          <section className="mt-8 rounded-[2rem] bg-gradient-to-b from-sun-100 to-transparent p-5 md:p-8 dark:from-sun-600/15">
            <h2 className="font-display text-2xl font-semibold">Trophy shelf</h2>
            {shelf.length === 0 ? (
              <p className="mt-2 text-muted-foreground">Your first badge is one quiz away!</p>
            ) : (
              <motion.ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" variants={stagger(0.08)} initial="hidden" animate="shown">
                {shelf.map((badge) => {
                  const latest = data.earned.find((b) => b.badge === badge.badge)
                  const times = counts.get(badge.badge) ?? 1
                  return (
                    <motion.li key={badge.badge} variants={pop} whileHover={{ y: -6, rotate: -2 }} className="relative flex flex-col items-center rounded-3xl bg-surface p-4 text-center shadow">
                      <BadgeMedal badge={badge.badge} size={80} />
                      {times > 1 && (
                        <span className="absolute top-3 right-3 grid min-w-8 place-items-center rounded-full bg-primary px-2 py-0.5 text-sm font-bold text-primary-foreground">×{times}</span>
                      )}
                      <p className="mt-2 font-display text-lg font-semibold">{badge.name}</p>
                      <p className="text-sm text-muted-foreground">{latest?.reason || badge.description}</p>
                    </motion.li>
                  )
                })}
              </motion.ul>
            )}
          </section>
          {toEarn.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-2xl font-semibold">Still to earn</h2>
              <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {toEarn.map((badge) => (
                  <li key={badge.badge} className={cn('flex flex-col items-center rounded-3xl border-2 border-dashed border-border p-4 text-center')}>
                    <BadgeMedal badge={badge.badge} size={64} locked />
                    <p className="mt-2 font-display text-lg font-semibold text-muted-foreground">{badge.name}</p>
                    <p className="text-sm text-muted-foreground">{badge.hint}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Page>
  )
}
