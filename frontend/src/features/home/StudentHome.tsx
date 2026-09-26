/**
 * A student's first screen: their buddy saying hello, what is waiting from
 * their teachers, how their streak and badges are going, and what to
 * practise next. One request (`/me/home`) so it arrives all at once.
 */
import { motion } from 'motion/react'
import { UpNext } from '@/features/live/schedule/UpNext'
import { ArrowRight, Barbell, Confetti, Fire, Medal, Trophy, UsersThree } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Alert, ButtonLink, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { Buddy, BuddyStage, greeting, tipFor, type BuddyHandle } from '@/features/buddies'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { useNotifications } from '@/features/notifications/NotificationsProvider'
import { playApi, type Home } from '@/features/play/api'
import { TodoCard } from '@/features/play/TodoCard'
import { useResource } from '@/hooks/useResource'
import { useAuth } from '@/lib/auth'
import { firstName } from '@/lib/user'
import { cn } from '@/lib/utils'
import { Page, pop, stagger } from '@/motion'
import { useLive } from '@/lib/bus'
import { MadeForYou } from './MadeForYou'

export default function StudentHome() {
  const { user } = useAuth()
  const home = useResource('student-home', () => playApi.home())
  // Live: a new share, a closed quiz or a class approval shows up at once.
  useLive(['assignments', 'classes'], () => void home.reload())
  const buddy = useRef<BuddyHandle>(null)
  const data = home.data
  // Practice made for them just landed in the bell: show it here too.
  const { latestArrival } = useNotifications()
  useEffect(() => {
    if (latestArrival?.type === 'practice_ready') void home.reload()
  }, [latestArrival])

  // Hello first, then a tip that knows what they could practise — once, when
  // the page first has something to say, not on every live refresh.
  const ready = Boolean(data)
  useEffect(() => {
    if (!data) return
    const hello = window.setTimeout(() => buddy.current?.cue('hello', { name: user ? firstName(user) : undefined }), 600)
    const tip = window.setTimeout(
      () => buddy.current?.say(tipFor('home', { practise: data.practise.map((s) => s.label), strengths: data.strengths.map((s) => s.label) })),
      5200,
    )
    return () => (window.clearTimeout(hello), window.clearTimeout(tip))
    // `data` is read when ready first turns true; refreshes must not re-greet.
  }, [ready])

  return (
    <Page className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <BuddyStage buddy={user?.buddy} className="grid items-end gap-2 px-5 pt-6 pb-5 md:grid-cols-[auto_1fr] md:gap-6 md:px-8 md:pt-8">
        <div className="order-2 flex justify-center pt-16 md:order-1 md:pt-20">
          <Buddy ref={buddy} buddy={user?.buddy} size={170} bubble="top" />
        </div>
        <div className="order-1 pb-2 md:order-2">
          <p className="font-display text-lg font-semibold text-muted-foreground">{greeting()},</p>
          <h1 className="font-celebrate text-4xl leading-tight md:text-5xl">{user ? firstName(user) : 'friend'}!</h1>
          <Stats home={data} />
        </div>
      </BuddyStage>

      {home.error && <Alert className="mt-6">{home.error}</Alert>}
      <UpNext className="mt-8" />
      <section className="mt-10">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold">From your teachers</h2>
          <Link to="/classes" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
            My classes <ArrowRight weight="bold" className="size-4" />
          </Link>
        </div>
        {!data ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-44 rounded-[1.75rem]" />
            ))}
          </div>
        ) : data.todo.length === 0 ? (
          <EmptyState
            art={<EmptyArt Icon={Confetti} tone="from-mint-100 to-sun-100" />}
            title="All caught up!"
            body="Nothing waiting right now. Make your own practice set, or join a class with a code."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink to="/library" variant="sun">
                  <Barbell weight="fill" className="size-5" />
                  Practise
                </ButtonLink>
                <ButtonLink to="/classes" variant="outline">
                  <UsersThree weight="duotone" className="size-5" />
                  Join a class
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <motion.ul className="mt-4 grid gap-4 sm:grid-cols-2" variants={stagger(0.07)} initial="hidden" animate="shown">
            {data.todo.map((todo) => (
              <TodoCard key={todo.assignment_id} todo={todo} />
            ))}
          </motion.ul>
        )}
      </section>

      {data && <MadeForYou className="mt-10" items={data.made_for_you ?? []} buddy={user?.buddy} />}

      {data && data.practise.length > 0 && <PractiseNext home={data} />}

      {data && data.done.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">Done lately</h2>
          <motion.ul className="mt-4 grid gap-4 sm:grid-cols-2" variants={stagger(0.06)} initial="hidden" animate="shown">
            {data.done.map((todo) => (
              <TodoCard key={todo.assignment_id} todo={todo} />
            ))}
          </motion.ul>
        </section>
      )}
    </Page>
  )
}

function Stats({ home }: { home: Home | null }) {
  const streak = home?.streak ?? 0
  return (
    <motion.div className="mt-4 flex flex-wrap gap-2" variants={stagger(0.1, 0.3)} initial="hidden" animate={home ? 'shown' : 'hidden'}>
      <motion.span variants={pop} className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2 font-bold', streak > 0 ? 'bg-kind-quiz-vivid text-white' : 'bg-surface text-muted-foreground')}>
        <Fire weight="fill" className="size-5" />
        {streak > 0 ? `${streak}-day streak` : 'Start a streak today'}
      </motion.span>
      <motion.span variants={pop}>
        <Link to="/badges" className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 font-bold shadow-sm hover:shadow">
          <Medal weight="fill" className="size-5 text-star" />
          {home?.badges ?? 0} {home?.badges === 1 ? 'badge' : 'badges'}
        </Link>
      </motion.span>
      <motion.span variants={pop}>
        <Link to="/results" className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 font-bold shadow-sm hover:shadow">
          <Trophy weight="fill" className="size-5 text-primary" />
          My results
        </Link>
      </motion.span>
    </motion.div>
  )
}

function PractiseNext({ home }: { home: Home }) {
  return (
    <section className="mt-10 rounded-[1.75rem] border-2 border-dashed border-border p-5">
      <h2 className="font-display text-xl font-semibold">Worth another look</h2>
      <p className="mt-1 text-muted-foreground">These were tricky last time. A practice set on one would help!</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {home.practise.map((skill) => (
          <li key={skill.subject + skill.slug}>
            <Link to={practiceFor(home, skill.label)} className="inline-flex items-center gap-1.5 rounded-full bg-wrong-soft px-4 py-1.5 font-bold capitalize text-destructive hover:brightness-95">
              <Barbell weight="fill" className="size-4" />
              {skill.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Straight to the practice made for this skill, when there is one. */
function practiceFor(home: Home, label: string): string {
  const made = home.made_for_you?.find((m) => !m.done && m.skills.some((s) => s.toLowerCase() === label.toLowerCase()))
  return made ? `/practice/${made.set_id}` : '/library'
}
