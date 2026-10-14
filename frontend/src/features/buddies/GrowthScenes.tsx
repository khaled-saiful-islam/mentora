/**
 * The big moments of a growing buddy (§28.3.1).
 *
 * - **Arrival**: meeting the baby, tiny and wobbly — every student's buddy
 *   starts as a newborn, existing students too.
 * - **Growing up**: the buddy grows before the child's eyes, then shows off
 *   each move it has just learned, one after another.
 *
 * Queued through the celebration queue, so neither ever lands mid-question,
 * and marked seen when closed, so neither plays twice.
 */
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { BUZZ, buzz } from '@/lib/haptics'
import { useSoundOn } from '@/lib/prefs'
import { celebrate as confetti, useCalmMotion } from '@/motion'
import { useCelebrate } from '@/features/celebrate/CelebrationProvider'
import { Scene } from '@/features/celebrate/Scene'
import { Buddy, type BuddyHandle } from './Buddy'
import { GrowthBar } from './GrowthBar'
import { useGrowth, type Growth } from './GrowthProvider'
import { described, learnedBetween, MOVE_NAMES, STAGE_NAMES, STAGES, stageFor, type Stage } from './growth'
import { BUDDIES } from './profiles'
import { playBuddySound } from './sounds'
import { isBuddyKey, type BuddyKey, type Mood } from './types'

// The buddy grows this long after the scene opens: long enough to see it small.
const GROW_AFTER_MS = 900
// Each new move is shown for this long.
const MOVE_MS = 1800

/** Watches the student's growth and asks for the moment it calls for. */
export function GrowthCelebrations() {
  const { user } = useAuth()
  const growth = useGrowth()
  const celebrate = useCelebrate()
  const now = growth?.growth
  const buddy = isBuddyKey(user?.buddy) ? user.buddy : null
  const seen = growth?.seen

  useEffect(() => {
    if (!now || !buddy || !seen) return
    if (!now.arrived) {
      celebrate({
        id: 'arrival',
        render: (close) => <ArrivalScene buddy={buddy} growth={now} onClose={close} />,
        onClose: () => void seen(),
      })
    } else if (now.grew) {
      const from = stageFor(now.seen_points)
      const to = now.stage as Stage
      celebrate({
        id: `grow-${to}`,
        render: (close) => <GrowScene buddy={buddy} from={from} to={to} onClose={close} />,
        onClose: () => void seen(),
      })
    }
  }, [now, buddy, seen, celebrate])

  return null
}

export function ArrivalScene({ buddy, growth, onClose }: { buddy: BuddyKey; growth: Growth; onClose: () => void }) {
  const figure = useRef<BuddyHandle>(null)
  const sound = useSoundOn()
  const calm = useCalmMotion()
  const { name } = BUDDIES[buddy]

  useEffect(() => {
    const hello = window.setTimeout(() => {
      figure.current?.play('wave')
      figure.current?.say('Hi! I’m so little!')
      figure.current?.burst('heart', 4, 'side')
      if (sound) playBuddySound(buddy, 'hello')
      buzz(BUZZ.unlock, sound)
      confetti({ calm, power: 0.5 })
    }, 500)
    return () => window.clearTimeout(hello)
  }, [buddy, sound, calm])

  return (
    <Scene kicker="Look who's here!" title={`Baby ${name}!`} colour={`--buddy-${buddy}`} onClose={onClose} action="Let's grow together!">
      {/* Room above for what it says, clear of the title. */}
      <div className="pt-16">
        <Buddy ref={figure} buddy={buddy} stage={0} size={190} bubble="top" />
      </div>
      <p className="mt-1 text-lg leading-snug">
        {name} is {described(buddy, 0)}: tiny, sleepy and a bit wobbly.
      </p>
      <p className="mt-2 leading-snug text-muted-foreground">
        Every quiz, game and badge helps {name} grow up and learn new moves.
      </p>
      <StagePath stage={0} />
      <GrowthBar buddy={buddy} points={growth.points} className="mt-4" />
    </Scene>
  )
}

export function GrowScene({ buddy, from, to, onClose }: { buddy: BuddyKey; from: Stage; to: Stage; onClose: () => void }) {
  const figure = useRef<BuddyHandle>(null)
  const sound = useSoundOn()
  const calm = useCalmMotion()
  const [shown, setShown] = useState<Stage>(from)
  const { name } = BUDDIES[buddy]
  const moves = learnedBetween(from, to)

  useEffect(() => {
    const timers: number[] = []
    timers.push(
      window.setTimeout(() => {
        setShown(to)
        figure.current?.play('celebrate', 1500)
        figure.current?.burst('star', 10, 'top')
        if (sound) playBuddySound(buddy, 'grow')
        buzz(BUZZ.grow, sound)
        confetti({ calm, power: 1.2 })
      }, GROW_AFTER_MS),
    )
    // Then each new move, in turn: a little show of what it learned.
    moves.forEach((mood: Mood, n) => {
      timers.push(window.setTimeout(() => figure.current?.play(mood, MOVE_MS - 200), GROW_AFTER_MS + 1600 + n * MOVE_MS))
    })
    return () => timers.forEach((timer) => window.clearTimeout(timer))
    // Played once, as the scene opens.
  }, [])

  const names = moves.map((mood) => (mood === 'trick' ? BUDDIES[buddy].trick : MOVE_NAMES[mood])).filter(Boolean)
  return (
    <Scene kicker="Wow, look!" title={`${name} grew up!`} colour={`--buddy-${buddy}`} onClose={onClose} action="Yay!">
      <div className="pt-16">
        <Buddy ref={figure} buddy={buddy} stage={shown} size={200} bubble="top" />
      </div>
      <p className="mt-1 text-lg leading-snug">
        {name} is {described(buddy, to)} now, all because you kept learning.
      </p>
      <StagePath stage={to} />
      {names.length > 0 && (
        <div className="mt-4 w-full">
          <p className="font-display text-lg font-semibold">New moves</p>
          <ul className="mt-2 flex flex-wrap justify-center gap-2">
            {names.map((label) => (
              <li key={label} className="rounded-full px-3 py-1 text-sm font-bold" style={{ background: `hsl(var(--buddy-${buddy}) / 0.18)` }}>
                {label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Scene>
  )
}

/** Newborn → Little one → Young → Grown, with where the buddy is now. */
export function StagePath({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <ol className={`mt-4 grid w-full grid-cols-4 gap-1 ${className ?? ''}`} aria-label={`Stage: ${STAGE_NAMES[stage]}`}>
      {STAGES.map((step) => (
        <li key={step} className="flex flex-col items-center gap-1">
          <span
            className={`grid size-7 place-items-center rounded-full text-xs font-bold ${step <= stage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            aria-current={step === stage ? 'step' : undefined}
          >
            {step + 1}
          </span>
          <span className={`break-words text-center text-xs font-bold leading-tight ${step === stage ? '' : 'text-muted-foreground'}`}>{STAGE_NAMES[step]}</span>
        </li>
      ))}
    </ol>
  )
}
