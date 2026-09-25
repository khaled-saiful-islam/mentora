/**
 * Astra, the tutor: a little planet with a ring, drawn with the buddies' own
 * parts so it lives the way they do — it breathes, blinks, watches, waves and
 * cheers with the same choreography.
 *
 * Its mouth is the one thing no buddy has: it moves with the *actual* voice.
 * `level` is the loudness of what is being heard right now, so the mouth
 * opens on the stressed syllables and closes in the pauses, and the glow
 * behind it breathes with the sound.
 */
import { motion, useTransform, type MotionValue } from 'motion/react'
import { useId, useMemo, useRef } from 'react'
import { choreograph } from '@/features/buddies/choreography'
import { useBlink, useGaze } from '@/features/buddies/hooks'
import { Cheeks, Eyes, Follow, Gloss, Mouth, MOUTH_FOR, starPath } from '@/features/buddies/parts'
import { INK, paint, pivot, SHINE, TONGUE } from '@/features/buddies/paint'
import { Frame, Joint } from '@/features/buddies/rigs/Rig'
import type { Mood } from '@/features/buddies/types'
import { useCalmMotion } from '@/motion'
import { cn } from '@/lib/utils'

const BODY = paint('astra')
const DEEP = paint('astra-deep')
const LIGHT = paint('astra-light')
const RING = paint('astra-ring')
const GLOW = paint('astra-glow')

export const TUTOR_NAME = 'Astra'

/**
 * The mouth while speaking, as one closed shape with the same commands at
 * every size, so it can move smoothly between any two openings.
 */
export function talkingMouth(open: number, cx = 100, cy = 118, width = 20): string {
  const amount = Math.min(1, Math.max(0, open))
  const w = (width / 2) * (0.82 + amount * 0.22)
  const upper = 1.2 - amount * 3.5
  const lower = 3.5 + amount * 11
  const pull = w * 0.42
  return (
    `M ${cx - w} ${cy} ` +
    `C ${cx - w + pull} ${cy + upper} ${cx + w - pull} ${cy + upper} ${cx + w} ${cy} ` +
    `C ${cx + w - pull} ${cy + lower} ${cx - w + pull} ${cy + lower} ${cx - w} ${cy} Z`
  )
}

export function TutorAvatar({
  mood = 'idle',
  speaking,
  level,
  size = 200,
  className,
}: {
  mood?: Mood
  speaking: boolean
  level: MotionValue<number>
  size?: number
  className?: string
}) {
  const calm = useCalmMotion()
  const svg = useRef<SVGSVGElement>(null)
  const id = useId().replace(/:/g, '')
  const blinking = useBlink(true)
  const gaze = useGaze(svg, { track: !calm && !speaking, fixed: mood === 'think' ? { x: -0.6, y: -0.8 } : null })
  const moves = useMemo(() => choreograph(mood, {}, calm), [mood, calm])
  const mouthD = useTransform(level, (l) => talkingMouth(calm ? Math.min(l, 0.35) : l))
  const tongueY = useTransform(level, (l) => 118 + 3 + l * 6)
  const glowScale = useTransform(level, (l) => (calm ? 1 : 1 + l * 0.12))
  const glowOpacity = useTransform(level, (l) => 0.35 + l * 0.45)

  return (
    <div className={cn('relative inline-block shrink-0', className)} style={{ width: size, height: size }}>
      <svg
        ref={svg}
        viewBox="0 0 200 200"
        width={size}
        height={size}
        overflow="visible"
        role="img"
        aria-label={`${TUTOR_NAME}, your tutor${speaking ? ', speaking' : ''}`}
        className="block overflow-visible"
      >
        <defs>
          <radialGradient id={`${id}-body`} cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor={LIGHT} />
            <stop offset="45%" stopColor={BODY} />
            <stop offset="100%" stopColor={DEEP} />
          </radialGradient>
          <radialGradient id={`${id}-glow`}>
            <stop offset="0%" stopColor={GLOW} stopOpacity={0.9} />
            <stop offset="100%" stopColor={GLOW} stopOpacity={0} />
          </radialGradient>
        </defs>

        <motion.circle
          cx={100}
          cy={104}
          r={92}
          fill={`url(#${id}-glow)`}
          style={{ ...pivot(100, 104), scale: glowScale, opacity: glowOpacity }}
        />

        <Frame moves={moves} feet={178} ground={186} middle={104} shadow={42}>
          {/* The back of the ring, behind the planet. */}
          <Joint move={moves.extra} at={[100, 110]}>
            <path d="M28 118 C32 92 168 92 172 118" stroke={RING} strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.75} />
          </Joint>

          <Joint move={moves.armL} at={[52, 118]}>
            <path d="M52 118 C40 124 34 134 36 144" stroke={DEEP} strokeWidth={9} fill="none" strokeLinecap="round" />
            <circle cx={36} cy={146} r={6} fill={BODY} />
          </Joint>
          <Joint move={moves.armR} at={[148, 118]}>
            <path d="M148 118 C160 124 166 134 164 144" stroke={DEEP} strokeWidth={9} fill="none" strokeLinecap="round" />
            <circle cx={164} cy={146} r={6} fill={BODY} />
          </Joint>

          <Joint move={moves.head} at={[100, 150]}>
            <Follow gaze={gaze}>
              {/* A star on a stalk: the tutor's thought, twinkling. */}
              <Joint move={moves.earL} at={[100, 50]}>
                <path d="M100 52 C98 42 102 34 108 28" stroke={DEEP} strokeWidth={3} fill="none" strokeLinecap="round" />
                <motion.path
                  d={starPath(110, 24, 9, 4)}
                  fill={RING}
                  animate={calm ? undefined : { rotate: [0, 18, 0], scale: [1, 1.15, 1] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  style={pivot(110, 24)}
                />
              </Joint>

              <circle cx={100} cy={104} r={54} fill={`url(#${id}-body)`} />
              {/* Craters, softly. */}
              <circle cx={128} cy={82} r={7} fill={DEEP} opacity={0.18} />
              <circle cx={70} cy={132} r={5} fill={DEEP} opacity={0.16} />
              <Gloss cx={76} cy={76} rx={14} ry={7} />

              <Cheeks mood={mood} left={[70, 112]} right={[130, 112]} rx={8} />
              <Eyes mood={mood} gaze={gaze} blinking={blinking} left={[82, 96]} right={[118, 96]} size={9.5} />

              {speaking ? (
                <g>
                  <motion.path d={mouthD} fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
                  <motion.ellipse cx={100} cy={tongueY} rx={5} ry={2.4} fill={TONGUE} opacity={0.9} />
                </g>
              ) : (
                <Mouth shape={MOUTH_FOR[mood]} cx={100} cy={118} width={20} />
              )}
            </Follow>
          </Joint>

          {/* The front of the ring, across the planet's belly. */}
          <Joint move={moves.extra} at={[100, 110]}>
            <path d="M28 118 C34 146 166 146 172 118" stroke={RING} strokeWidth={7} fill="none" strokeLinecap="round" />
            <path d="M40 126 C60 138 90 141 112 140" stroke={SHINE} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.5} />
          </Joint>
        </Frame>
      </svg>
    </div>
  )
}
