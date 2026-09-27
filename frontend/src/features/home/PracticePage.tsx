/**
 * A student's practice. They no longer make sets: practice comes from what
 * their buddy makes out of the tricky bits of their class work, and from what
 * their family sends home. Anything they made before stays here to play.
 */
import { ArrowRight, Barbell, HeartStraight, Star } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Alert, ButtonLink, Chip, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { profileOf } from '@/features/buddies'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { lookOfKind, nounOf } from '@/features/learning/kinds'
import { playApi, type MyPractice } from '@/features/play/api'
import { FromHomeCard } from '@/features/play/TodoCard'
import { useResource } from '@/hooks/useResource'
import { useAuth } from '@/lib/auth'
import { useLive } from '@/lib/bus'
import { cn } from '@/lib/utils'
import { Page, rise, stagger } from '@/motion'
import { MadeForYou } from './MadeForYou'

export default function PracticePage() {
  const { user } = useAuth()
  const home = useResource('practice-home', () => playApi.home())
  const mine = useResource('practice-mine', () => playApi.practice())
  useLive(['assignments'], () => (void home.reload(), void mine.reload()))
  const buddy = profileOf(user?.buddy).name

  const made = home.data?.made_for_you ?? []
  const fromHome = home.data?.from_home ?? []
  const shown = new Set(made.map((m) => m.set_id))
  const rest = (mine.data?.items ?? []).filter((p) => !shown.has(p.id))
  const loading = !home.data || !mine.data
  const nothing = !loading && made.length === 0 && fromHome.length === 0 && rest.length === 0

  return (
    // A container: beside the sidebar the column is narrower than the window.
    <Page className="@container mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <motion.header variants={rise} initial="hidden" animate="shown" className="flex flex-wrap items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sun-400 text-grape-900 shadow-lg">
          <Barbell weight="fill" className="size-7" aria-hidden />
        </span>
        <div className="min-w-[min(100%,16rem)] flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">My practice</h1>
          <p className="text-muted-foreground">Made for you from the bits you found tricky, and sent from home. A few minutes each!</p>
        </div>
      </motion.header>

      {(home.error || mine.error) && <Alert className="mt-6">{home.error || mine.error}</Alert>}
      {loading ? (
        <div className="mt-8 grid gap-4 @xl:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-44 rounded-[1.75rem]" />
          ))}
        </div>
      ) : nothing ? (
        <EmptyState
          className="mt-8"
          art={<EmptyArt Icon={Barbell} tone="from-sun-100 to-grape-100" />}
          title="Nothing to practise yet"
          body={`When a quiz from your teacher is tricky, ${buddy} makes you a little practice on exactly those skills. It shows up here — and so does anything your family sends.`}
          action={<ButtonLink to="/">See what's waiting</ButtonLink>}
        />
      ) : (
        <div className="mt-8 space-y-10">
          <MadeForYou items={made} buddy={user?.buddy} />

          {fromHome.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
                <HeartStraight weight="fill" className="size-6 text-kind-family" aria-hidden />
                From home
              </h2>
              <motion.ul className={cn('mt-4 grid gap-4', fromHome.length > 1 && '@xl:grid-cols-2')} variants={stagger(0.07)} initial="hidden" animate="shown">
                {fromHome.map((work) => (
                  <FromHomeCard key={work.share_id} work={work} />
                ))}
              </motion.ul>
            </section>
          )}

          {home.data && home.data.practise.length > 0 && (
            <section className="rounded-[1.75rem] border-2 border-dashed border-border p-5">
              <h2 className="font-display text-xl font-semibold">Worth another look</h2>
              <p className="mt-1 text-muted-foreground">These were tricky last time. Finish a class quiz on one and {buddy} makes you practice on it.</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {home.data.practise.map((skill) => (
                  <li key={skill.subject + skill.slug}>
                    <Chip className="bg-wrong-soft px-4 py-1.5 text-sm capitalize text-destructive">
                      {skill.label}
                    </Chip>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-semibold">All my practice</h2>
              <motion.ul className={cn('mt-4 grid gap-2', rest.length > 1 && '@2xl:grid-cols-2')} variants={stagger(0.04)} initial="hidden" animate="shown">
                {rest.map((item) => (
                  <PracticeRow key={item.id} item={item} />
                ))}
              </motion.ul>
            </section>
          )}
        </div>
      )}
    </Page>
  )
}

function PracticeRow({ item }: { item: MyPractice }) {
  const kind = lookOfKind(item.kind)
  return (
    <motion.li variants={rise}>
      <Link to={`/practice/${item.id}`} className="group flex flex-wrap items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3 transition-colors hover:border-hover-border">
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', kind.hero)}>
          <kind.Icon weight="fill" className="size-6" aria-hidden />
        </span>
        <span className="min-w-[min(100%,12rem)] flex-1">
          <span className="block break-words font-bold leading-snug">{item.title}</span>
          <span className="text-sm text-muted-foreground">
            {kind.label} · {nounOf(item.kind, item.item_count)}
            {item.made_for_you ? ' · made for you' : ''}
          </span>
        </span>
        {item.best !== null ? (
          <Chip tone="mint">
            <Star weight="fill" className="size-3.5" aria-hidden /> Best {Math.round(item.best)}%
          </Chip>
        ) : (
          <Chip tone="sun">New</Chip>
        )}
        <span className="inline-flex items-center gap-1 font-bold text-primary transition-transform group-hover:translate-x-0.5">
          {item.tries ? 'Go again' : 'Practise'} <ArrowRight weight="bold" className="size-4" aria-hidden />
        </span>
      </Link>
    </motion.li>
  )
}
