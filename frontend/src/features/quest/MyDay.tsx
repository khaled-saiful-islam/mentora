/**
 * The top of a student's home (§28.3.4): **Today's Quest** — five quick
 * questions, review first — with their streak; their **skill garden**, a
 * plant for each skill that droops when it is due for review; and how their
 * class is doing on **this week's class quest**, which ends in a buddy party
 * when they reach it together. Nobody is ranked.
 */
import { motion } from 'motion/react'
import { CheckCircle, Compass, Fire, Snowflake, Sparkle, UsersThree } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { ButtonLink, Skeleton } from '@/components/ui'
import { Buddy, BuddyAvatar } from '@/features/buddies'
import { useCelebrate } from '@/features/celebrate/CelebrationProvider'
import { Scene } from '@/features/celebrate/Scene'
import { useResource } from '@/hooks/useResource'
import { cn } from '@/lib/utils'
import { celebrate as confetti, rise, spring, stagger, useCalmMotion } from '@/motion'
import { dayApi, type ClassQuest, type DayQuest, type MyDay as Day, type Plant } from './api'
import { PlantArt } from './Plant'

export function MyDay({ className }: { className?: string }) {
  const day = useResource('my-day', () => dayApi.get())
  const data = day.data
  if (!data) return day.error ? null : <Skeleton className={cn('h-48 rounded-[2rem]', className)} />
  return (
    <motion.div className={cn('space-y-6', className)} variants={stagger(0.08)} initial="hidden" animate="shown">
      <motion.div variants={rise}>
        <QuestCard quest={data.quest} streak={data.streak} />
      </motion.div>
      {data.garden.length > 0 && (
        <motion.div variants={rise}>
          <Garden plants={data.garden} />
        </motion.div>
      )}
      {data.classes.map((room) => (
        <motion.div key={room.class_id} variants={rise}>
          <ClassQuestCard room={room} />
        </motion.div>
      ))}
    </motion.div>
  )
}

function QuestCard({ quest, streak }: { quest: DayQuest | null; streak: Day['streak'] }) {
  const calm = useCalmMotion()
  return (
    <section
      aria-labelledby="quest-title"
      className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-kind-quiz-vivid p-5 text-white shadow-lg md:p-6"
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 opacity-15"
        animate={calm ? undefined : { rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      >
        <Compass weight="fill" className="size-48" />
      </motion.span>
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-[min(100%,16rem)] flex-1">
          <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-85">Today's Quest</p>
          {quest === null ? (
            <>
              <h2 id="quest-title" className="mt-1 font-celebrate text-3xl leading-tight">Your first quest is on its way</h2>
              <p className="mt-1 break-words opacity-90">It appears after your first quiz: five quick questions, made just for you, every day.</p>
            </>
          ) : quest.done ? (
            <>
              <h2 id="quest-title" className="mt-1 flex items-center gap-2 font-celebrate text-3xl leading-tight">
                <CheckCircle weight="fill" className="size-8 shrink-0 text-sun-300" aria-hidden />
                Done for today!
              </h2>
              <p className="mt-1 break-words opacity-90">Your plants are watered. A new quest is waiting tomorrow.</p>
            </>
          ) : (
            <>
              <h2 id="quest-title" className="mt-1 font-celebrate text-3xl leading-tight">
                {quest.questions} quick questions
              </h2>
              <p className="mt-1 break-words opacity-90">{questLine(quest)}</p>
              <ButtonLink to={`/practice/${quest.set_id}`} variant="sun" size="lg" className="mt-4">
                <Sparkle weight="fill" className="size-5" />
                Start the quest
              </ButtonLink>
            </>
          )}
        </div>
        <StreakFlame days={streak.days} freezes={streak.freezes} lit={streak.today_done} />
      </div>
    </section>
  )
}

function questLine(quest: DayQuest): string {
  const parts = [quest.review > 0 && `${quest.review} to water in your garden`, quest.fresh > 0 && `${quest.fresh} new`].filter(Boolean)
  return `${parts.join(' and ')}. About five minutes.`
}

/** The streak: a flame that burns when today is done, with freezes held. */
function StreakFlame({ days, freezes, lit }: { days: number; freezes: number; lit: boolean }) {
  const calm = useCalmMotion()
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 rounded-3xl bg-grape-900/30 px-5 py-3 text-center" aria-label={`${days}-day streak${freezes ? `, ${freezes} ${freezes === 1 ? 'freeze' : 'freezes'} held` : ''}`}>
      <motion.span
        aria-hidden
        className={cn('grid size-14 place-items-center rounded-full', lit ? 'bg-sun-400 text-grape-900' : 'bg-white/20 text-white')}
        animate={lit && !calm ? { scale: [1, 1.08, 1], rotate: [-3, 3, -3] } : undefined}
        transition={{ duration: 1.8, repeat: Infinity }}
      >
        <Fire weight="fill" className="size-8" />
      </motion.span>
      <p className="font-display text-2xl font-bold leading-none tabular-nums">{days}</p>
      <p className="text-xs font-bold uppercase tracking-wide opacity-85">{days === 1 ? 'day' : 'days'} in a row</p>
      {freezes > 0 && (
        <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold" title="A freeze covers a day you miss">
          <Snowflake weight="fill" className="size-3.5" aria-hidden />× {freezes}
        </p>
      )}
    </div>
  )
}

function Garden({ plants }: { plants: Plant[] }) {
  const calm = useCalmMotion()
  const thirsty = plants.filter((p) => p.thirsty).length
  return (
    <section aria-labelledby="garden-title" className="rounded-[2rem] border-2 border-border bg-surface p-5">
      <h2 id="garden-title" className="font-display text-2xl font-semibold">Your skill garden</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {thirsty > 0
          ? `${thirsty} ${thirsty === 1 ? 'plant needs' : 'plants need'} water — today's quest waters them.`
          : 'Every plant is watered. Keep learning and watch them bloom.'}
      </p>
      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {plants.map((plant) => (
          <li
            key={plant.skill}
            className={cn('flex flex-col items-center rounded-3xl p-2 text-center', plant.thirsty ? 'bg-sky-100 dark:bg-sky-700/25' : 'bg-correct-soft')}
            aria-label={`${plant.label}: ${Math.round(plant.mastery * 100)}% right${plant.thirsty ? ', needs water' : ''}`}
          >
            <PlantArt box={plant.box} thirsty={plant.thirsty} calm={calm} size={64} />
            <span className="break-words text-xs font-bold capitalize leading-tight">{plant.label}</span>
            {plant.thirsty && <span className="mt-0.5 text-[0.7rem] font-bold text-sky-700 dark:text-sky-300">Needs water</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

const PARTY_KEY = (room: ClassQuest) => `mentora:party:${room.class_id}:${room.week}`

function ClassQuestCard({ room }: { room: ClassQuest }) {
  const celebrate = useCelebrate()
  const reached = room.done >= room.goal
  const share = Math.min(1, room.done / room.goal)

  // A party once a week, the first time the class gets there.
  useEffect(() => {
    if (!reached) return
    try {
      if (window.localStorage.getItem(PARTY_KEY(room))) return
    } catch {
      return
    }
    celebrate({
      id: PARTY_KEY(room),
      render: (close) => <PartyScene room={room} onClose={close} />,
      onClose: () => {
        try {
          window.localStorage.setItem(PARTY_KEY(room), '1')
        } catch {
          // Shown again next visit: a party twice is no harm.
        }
      },
    })
  }, [reached, room, celebrate])

  return (
    <section aria-labelledby={`class-quest-${room.class_id}`} className="rounded-[2rem] border-2 border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`class-quest-${room.class_id}`} className="flex items-center gap-2 font-display text-xl font-semibold">
          <UsersThree weight="fill" className="size-6 shrink-0 text-primary" aria-hidden />
          <span className="break-words">Class quest · {room.name}</span>
        </h2>
        <ul className="flex -space-x-2" aria-hidden>
          {room.buddies.slice(0, 6).map((buddy, n) => (
            <li key={n}>
              <BuddyAvatar buddy={buddy} size={32} />
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {reached ? 'Goal reached — the buddies are having a party!' : 'Every quest anyone in your class finishes counts. Reach the goal together for a buddy party.'}
      </p>
      <div className="mt-3 h-4 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={room.goal} aria-valuenow={room.done} aria-label="Class quests this week">
        <motion.div className={cn('h-full rounded-full', reached ? 'bg-sun-400' : 'bg-primary')} initial={false} animate={{ width: `${Math.max(3, share * 100)}%` }} transition={spring.gentle} />
      </div>
      <p className="mt-1.5 text-sm font-bold">
        {room.done} of {room.goal} quests
      </p>
    </section>
  )
}

function PartyScene({ room, onClose }: { room: ClassQuest; onClose: () => void }) {
  const calm = useCalmMotion()
  useEffect(() => {
    const burst = window.setTimeout(() => confetti({ calm, power: 1.4 }), 400)
    return () => window.clearTimeout(burst)
  }, [calm])
  const dancers = room.buddies.slice(0, 8)
  return (
    <Scene kicker={room.name} title="Class quest complete!" colour="--sun-400" onClose={onClose} action="Yay, team!">
      <ul className="flex flex-wrap justify-center gap-1" aria-label="Your class's buddies, dancing">
        {dancers.map((buddy, n) => (
          <li key={n}>
            <Buddy buddy={buddy} size={76} mood="dance" interactive={false} track={false} lively={false} />
          </li>
        ))}
      </ul>
      {room.buddies.length > dancers.length && <p className="text-sm font-bold">and {room.buddies.length - dancers.length} more!</p>}
      <p className="mt-2 text-lg leading-snug">
        Your class finished {room.done} quests this week. Every one of you helped.
      </p>
    </Scene>
  )
}
