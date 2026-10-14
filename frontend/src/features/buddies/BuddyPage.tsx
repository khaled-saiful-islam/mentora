import { useRef, useState } from 'react'
import { ArrowsClockwise, Barbell, Confetti, HandWaving, Heart, Lightbulb, LockSimple, Moon, MusicNotes, Question, Smiley, Sparkle, Star } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { can, firstName, type User } from '@/lib/user'
import { Page } from '@/motion'
import { Buddy, type BuddyHandle } from './Buddy'
import { BuddyPicker } from './BuddyPicker'
import { BuddyStage } from './BuddyStage'
import { described, GROWN, knows, LEARNED_AT, STAGE_NAMES, type Stage } from './growth'
import { GrowthBar } from './GrowthBar'
import { useGrowth, useMyStage, type Growth } from './GrowthProvider'
import { StagePath } from './GrowthScenes'
import { BUDDIES, profileOf } from './profiles'
import { isBuddyKey, type BuddyKey, type Mood } from './types'
import { pick, VOICES } from './voices'

interface Action {
  label: string
  Icon: Icon
  /** The move it plays, which decides when it is learned (§28.3.1). */
  move: Mood
  run: (buddy: BuddyHandle, key: BuddyKey) => void
}

const ACTIONS: Action[] = [
  { label: 'Giggle', Icon: Smiley, move: 'giggle', run: (b) => b.play('giggle') },
  { label: 'Nap', Icon: Moon, move: 'sleepy', run: (b, k) => (b.play('sleepy', 4500), b.say(VOICES[k].sleepy)) },
  { label: 'Think', Icon: Lightbulb, move: 'think', run: (b) => b.play('think', 3000) },
  { label: 'Fun fact', Icon: Question, move: 'think', run: (b, k) => (b.play('think'), b.say(pick(VOICES[k].facts))) },
  { label: 'Wave', Icon: HandWaving, move: 'wave', run: (b, k) => (b.play('wave'), b.say(pick(VOICES[k].hello))) },
  { label: 'Hug', Icon: Heart, move: 'hug', run: (b, k) => (b.play('hug'), b.say(pick(VOICES[k].cheers))) },
  { label: 'Dance', Icon: MusicNotes, move: 'dance', run: (b) => b.play('dance', 4200) },
  { label: 'Cheer', Icon: Confetti, move: 'celebrate', run: (b, k) => (b.play('celebrate', 3000), b.say(pick(VOICES[k].finish.great))) },
  { label: 'Twirl', Icon: ArrowsClockwise, move: 'twirl', run: (b) => b.play('twirl') },
  { label: 'Star jump', Icon: Star, move: 'starjump', run: (b) => b.play('starjump') },
  { label: 'Flex', Icon: Barbell, move: 'flex', run: (b) => b.play('flex') },
  { label: 'Trick', Icon: Sparkle, move: 'trick', run: (b) => b.trick() },
]

// Ways to grow, as `app/growth/rules.py` counts them.
const HOW_TO_GROW = [
  ['Finish a quiz, game or guide', '+2'],
  ['Get three stars', '+2'],
  ['Learn something every day', '+1'],
  ['Earn a badge', '+3'],
  ['Master a skill', '+10'],
] as const

/** Meet your buddy, play with them, watch them grow, or choose another. */
export default function BuddyPage() {
  const { user, updateUser } = useAuth()
  const { toast } = useToast()
  const figure = useRef<BuddyHandle>(null)
  const [saving, setSaving] = useState(false)
  const current = profileOf(user?.buddy)
  const growing = can(user, 'take_assignments')
  const growthState = useGrowth()
  const growth = growthState?.growth ?? null
  const stage: Stage = useMyStage() ?? GROWN

  async function choose(key: BuddyKey) {
    if (!user || key === user.buddy) return
    const before = user
    updateUser({ ...user, buddy: key })
    setSaving(true)
    try {
      updateUser(await apiFetch<User>('/auth/me', { method: 'PATCH', body: JSON.stringify({ buddy: key }) }))
      toast(`${BUDDIES[key].name} is your buddy now!`, { tone: 'success' })
      void growthState?.refresh()
    } catch (error) {
      updateUser(before)
      toast('Could not change your buddy', { tone: 'error', body: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Your study buddy</h1>
      <p className="mt-1 text-muted-foreground">
        {user ? `${current.name} is always with you, ${firstName(user)}.` : ''} Tap them — they love it.
      </p>

      <BuddyStage buddy={current.key} className="mt-6 flex flex-col items-center px-4 pt-24 pb-6">
        <Buddy key={current.key} ref={figure} buddy={current.key} size={240} bubble="top" own />
        <p className="mt-2 text-center font-display text-3xl font-semibold">
          {current.name}{' '}
          <span className="text-muted-foreground">{growing ? `is ${described(current.key, stage)}` : `the ${current.species}`}</span>
        </p>
        {growing && growth && (
          <div className="mt-4 w-full max-w-md">
            <StagePath stage={stage} />
            <GrowthBar buddy={current.key} points={growth.points} className="mt-4" />
          </div>
        )}
        <Moves stage={growing ? stage : GROWN} onPlay={(action) => figure.current && action.run(figure.current, current.key)} buddy={current.key} />
      </BuddyStage>

      {growing && <HowToGrow name={current.name} skills={growth?.skills_mastered ?? 0} />}

      <h2 className="mt-12 font-display text-2xl font-semibold">{growing ? 'Buddy friends' : 'Choose a buddy'}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{growing ? friendsLine(growth) : 'You can change any time. Everyone gets their own.'}</p>
      <div className="mt-5" aria-busy={saving}>
        <BuddyPicker
          value={isBuddyKey(user?.buddy) ? user.buddy : null}
          onChange={(key) => void choose(key)}
          stage={growing ? stage : undefined}
          locked={growing && growth ? (key) => lockedWhy(key, growth) : undefined}
          onLocked={(key, why) => toast(`${BUDDIES[key].name} is still to meet`, { body: `${why} — every badge brings a new buddy friend closer!` })}
        />
      </div>
    </Page>
  )
}

/** Every move, learned or still to learn: a locked one says when it comes. */
function Moves({ stage, buddy, onPlay }: { stage: Stage; buddy: BuddyKey; onPlay: (action: Action) => void }) {
  return (
    <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Moves">
      {ACTIONS.map((action) => {
        const { label, Icon, move } = action
        const learned = knows(move, stage)
        const name = move === 'trick' ? BUDDIES[buddy].trick : label
        const at = LEARNED_AT[move] ?? 0
        return (
          <li key={label}>
            {learned ? (
              <Button variant="outline" size="sm" onClick={() => onPlay(action)}>
                <Icon weight="duotone" className="size-4" />
                {name}
              </Button>
            ) : (
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border-2 border-dashed border-border px-3 py-1 text-sm font-bold text-muted-foreground" title={`Learned when ${STAGE_NAMES[at as Stage].toLowerCase()}`}>
                <LockSimple weight="fill" className="size-4 shrink-0" aria-hidden />
                <span className="break-words">{name}</span>
                <span className="sr-only">: learned when {STAGE_NAMES[at as Stage].toLowerCase()}</span>
                <span aria-hidden className="text-xs font-semibold opacity-80">· {STAGE_NAMES[at as Stage]}</span>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function HowToGrow({ name, skills }: { name: string; skills: number }) {
  return (
    <section className="mt-8 rounded-[1.75rem] border border-border bg-surface p-5" aria-labelledby="grow-heading">
      <h2 id="grow-heading" className="font-display text-2xl font-semibold">
        How {name} grows
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Everything you learn helps. {skills > 0 ? `You've mastered ${skills} ${skills === 1 ? 'skill' : 'skills'} so far!` : 'Master a skill for the biggest boost.'}
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {HOW_TO_GROW.map(([what, points]) => (
          <li key={what} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3">
            <span className="min-w-0 break-words font-semibold">{what}</span>
            <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-sm font-bold text-primary-foreground">{points}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function friendsLine(growth: Growth | null): string {
  if (!growth) return 'Earn badges to meet new buddy friends.'
  const met = `You've met ${growth.met.length} of 5 buddies.`
  if (growth.may_meet > 0) return `${met} You can meet a new one now — pick who!`
  if (growth.badges_for_next === null) return `${met} Switch between them any time.`
  const more = growth.badges_for_next
  return `${met} Earn ${more} more ${more === 1 ? 'badge' : 'badges'} to meet the next.`
}

/** Why this buddy cannot be chosen yet, or null when it can. */
function lockedWhy(key: BuddyKey, growth: Growth): string | null {
  if (growth.met.includes(key) || growth.may_meet > 0 || growth.met.length === 0) return null
  const more = growth.badges_for_next ?? 0
  return `${more} more ${more === 1 ? 'badge' : 'badges'}`
}
