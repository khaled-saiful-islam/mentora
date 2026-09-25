/**
 * A study buddy on screen: the rig, alive. It breathes, blinks, watches
 * the pointer, fidgets, dozes off, reacts, talks, and does its trick when
 * tapped.
 *
 * The screen sets a lasting `mood`; anything momentary goes through the
 * handle — `buddy.current.cue('correct', { streak })` — so a player never
 * has to know what a cheer looks like.
 */
import { AnimatePresence, motion } from 'motion/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useCalmMotion } from '@/motion'
import { cn } from '@/lib/utils'
import { choreograph } from './choreography'
import { useBlink, useBuddyMood, useGaze, useSpeech } from './hooks'
import { MOUTH_FOR } from './parts'
import { Particles, useParticles, type ParticleKind } from './particles'
import { profileOf, type Anchor, type BuddyProfile } from './profiles'
import { performanceFor, type Cue, type CueContext } from './reactions'
import { SpeechBubble, type BubbleSide } from './SpeechBubble'
import type { Mood } from './types'
import { pick, VOICES } from './voices'

export interface BuddyHandle {
  play: (mood: Mood, ms?: number) => void
  say: (line: string, ms?: number) => void
  burst: (kind: ParticleKind, count: number, from?: Anchor) => void
  cue: (cue: Cue, context?: CueContext) => void
  /** The signature move, with its sparkle — what a tap does. */
  trick: (speak?: boolean) => void
}

export interface BuddyProps {
  buddy: string | null | undefined
  mood?: Mood
  size?: number
  /** Tap for a trick. Off for a buddy that is only decoration. */
  interactive?: boolean
  /** Eyes follow the pointer. */
  track?: boolean
  /** Fidgets and dozes when left alone. */
  lively?: boolean
  bubble?: BubbleSide
  className?: string
}

// Small buddies — in a list, on a podium — keep their face and skip the fuss.
const LITE_BELOW = 72

const BURSTS: Partial<Record<Mood, [ParticleKind, number, Anchor]>> = {
  happy: ['sparkle', 5, 'body'],
  cheer: ['star', 7, 'body'],
  oops: ['sweat', 1, 'side'],
  wave: ['heart', 2, 'side'],
  celebrate: ['confetti', 18, 'top'],
}

const AMBIENT: Partial<Record<Mood, [ParticleKind, number, Anchor, number]>> = {
  sleepy: ['zzz', 1, 'side', 1500],
  dance: ['note', 1, 'top', 650],
  think: ['question', 1, 'top', 2300],
  celebrate: ['confetti', 7, 'top', 900],
}

const FIXED_GAZE: Partial<Record<Mood, { x: number; y: number }>> = {
  think: { x: -0.6, y: -0.85 },
  sleepy: { x: 0, y: 0.3 },
  yawn: { x: 0, y: -0.2 },
}

const SECRET_TAPS = 5
const TAP_WINDOW_MS = 1800

export const Buddy = forwardRef<BuddyHandle, BuddyProps>(function Buddy(
  { buddy, mood: base = 'idle', size = 160, interactive = true, track = true, lively = true, bubble = 'top', className },
  ref,
) {
  const profile = profileOf(buddy)
  const calm = useCalmMotion()
  const lite = size < LITE_BELOW
  const svg = useRef<SVGSVGElement>(null)
  const { mood, play } = useBuddyMood(base, { lively: lively && !lite, calm })
  const blinking = useBlink(true)
  const gaze = useGaze(svg, { track: track && !lite && !calm, fixed: FIXED_GAZE[mood] ?? null })
  const field = useParticles(!calm && !lite)
  const { emit } = field
  const speech = useSpeech()
  const moves = useMemo(() => choreograph(mood, profile.signature, calm), [mood, profile, calm])
  const mouth = profile.mouths[mood] ?? MOUTH_FOR[mood]

  const burst = useCallback(
    (kind: ParticleKind, count: number, from: Anchor = 'body') => emit(kind, count, profile.anchors[from]),
    [emit, profile],
  )

  useMoodEffects(mood, profile, burst)

  const trick = useCallback(
    (speak = true) => {
      play('trick')
      if (speak) speech.say(pick(VOICES[profile.key].tap))
      const { kind, count, from, delayMs } = profile.trickBurst
      window.setTimeout(() => burst(kind, count, from), delayMs)
    },
    [play, speech.say, burst, profile],
  )

  const handle = useMemo<BuddyHandle>(
    () => ({
      play,
      say: speech.say,
      burst,
      trick,
      cue: (cue, context) => {
        const act = performanceFor(cue, profile.key, context)
        play(act.mood)
        if (act.line) speech.say(act.line)
        if (act.burst) burst(...act.burst)
      },
    }),
    [play, speech.say, burst, trick, profile.key],
  )
  useImperativeHandle(ref, () => handle, [handle])

  const taps = useRef<number[]>([])
  const onTap = () => {
    const now = Date.now()
    taps.current = [...taps.current.filter((t) => now - t < TAP_WINDOW_MS), now]
    if (taps.current.length >= SECRET_TAPS) {
      taps.current = []
      play('dance', 3800)
      speech.say(VOICES[profile.key].secret)
      return
    }
    trick()
  }

  const { Rig } = profile
  const art = (
    <svg
      ref={svg}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      overflow="visible"
      role="img"
      aria-label={`${profile.name} the ${profile.species}`}
      className="block overflow-visible"
    >
      <Rig mood={mood} mouth={mouth} moves={moves} gaze={gaze} blinking={blinking} calm={calm} />
      <Particles field={field} />
    </svg>
  )

  return (
    <div className={cn('relative inline-block shrink-0', className)} style={{ width: size, height: size }}>
      <AnimatePresence>{!lite && speech.line && <SpeechBubble text={speech.line} side={bubble} />}</AnimatePresence>
      {interactive ? (
        <motion.button
          type="button"
          onClick={onTap}
          whileTap={{ scale: 0.94 }}
          className="block cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
          aria-label={`${profile.name} the ${profile.species}. Tap for a ${profile.trick.toLowerCase()}!`}
        >
          {art}
        </motion.button>
      ) : (
        art
      )}
    </div>
  )
})

/** Bursts when a mood starts, and a steady trickle while some moods last. */
function useMoodEffects(
  mood: Mood,
  profile: BuddyProfile,
  burst: (kind: ParticleKind, count: number, from?: Anchor) => void,
) {
  useEffect(() => {
    const once = BURSTS[mood]
    if (once) burst(...once)
    const ambient = AMBIENT[mood]
    if (!ambient) return
    const [kind, count, from, every] = ambient
    const timer = window.setInterval(() => burst(kind, count, from), every)
    return () => window.clearInterval(timer)
  }, [mood, profile, burst])
}
