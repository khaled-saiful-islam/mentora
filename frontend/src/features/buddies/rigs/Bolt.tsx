/** Bolt the robot — hovers on a little thruster, thinks on a glowing screen,
 *  and lights up the bulb on its antenna when an idea lands. */
import { motion } from 'motion/react'
import { Frame, Joint } from './Rig'
import { Cheeks, Eyes, Follow, Gloss, Mouth } from '../parts'
import { BLUSH, paint, pivot, SHINE } from '../paint'
import type { Mood, RigProps } from '../types'

const STEEL = paint('bolt')
const DEEP = paint('bolt-deep')
const LIGHT = paint('bolt-light')
const SCREEN = paint('bolt-screen')
const GLOW = paint('bolt-glow')
const BULB = paint('bolt-bulb')

const LEDS = [
  [89, GLOW],
  [100, BULB],
  [111, BLUSH],
] as const

// Powered down while asleep: the flame gutters and the lights dim.
const POWER: Partial<Record<Mood, number>> = { sleepy: 0.25, yawn: 0.5 }

export function BoltRig({ mood, mouth, moves, gaze, blinking, calm }: RigProps) {
  const power = POWER[mood] ?? 1
  const live = !calm && power === 1
  return (
    <Frame moves={moves} feet={178} ground={200} middle={118} shadow={30}>
      <path d="M90 168 L110 168 L106 178 L94 178 Z" fill={DEEP} />
      <motion.path
        d="M93 178 Q100 198 107 178 Z"
        fill={GLOW}
        style={{ ...pivot(100, 178), filter: `drop-shadow(0 0 5px ${GLOW})` }}
        animate={live ? { scaleY: [1, 1.35, 0.9, 1.25, 1], opacity: [0.9, 1, 0.75, 1, 0.9] } : { scaleY: power, opacity: power }}
        transition={live ? { duration: 0.42, repeat: Infinity } : { duration: 0.4 }}
      />

      <rect x={70} y={122} width={60} height={48} rx={18} fill={STEEL} />
      <rect x={79} y={131} width={42} height={30} rx={12} fill={LIGHT} />
      {LEDS.map(([cx, colour], i) => (
        <motion.circle
          key={cx}
          cx={cx}
          cy={146}
          r={4}
          fill={colour}
          animate={live ? { opacity: [0.35, 1, 0.35] } : { opacity: 0.35 * power + 0.2 }}
          transition={live ? { duration: 1.2, repeat: Infinity, delay: i * 0.2 } : { duration: 0.3 }}
        />
      ))}
      <circle cx={76} cy={128} r={1.8} fill={DEEP} />
      <circle cx={124} cy={128} r={1.8} fill={DEEP} />
      <rect x={93} y={113} width={14} height={11} rx={3} fill={DEEP} />

      <Joint move={moves.head} at={[100, 120]}>
        <Follow gaze={gaze}>
          <Joint move={moves.earL} at={[54, 84]}>
            <circle cx={54} cy={84} r={11} fill={DEEP} />
            <path d="M54 76 L54 92 M46 84 L62 84" stroke={STEEL} strokeWidth={2.4} strokeLinecap="round" />
            <circle cx={54} cy={84} r={4.5} fill={LIGHT} />
          </Joint>
          <Joint move={moves.earR} at={[146, 84]}>
            <circle cx={146} cy={84} r={11} fill={DEEP} />
            <path d="M146 76 L146 92 M138 84 L154 84" stroke={STEEL} strokeWidth={2.4} strokeLinecap="round" />
            <circle cx={146} cy={84} r={4.5} fill={LIGHT} />
          </Joint>

          <Joint move={moves.extra} at={[100, 50]}>
            <path d="M100 50 L100 33" stroke={DEEP} strokeWidth={3.5} strokeLinecap="round" />
            <motion.circle
              cx={100}
              cy={28}
              r={11}
              fill={BULB}
              animate={live ? { opacity: [0.12, 0.45, 0.12] } : { opacity: 0.1 * power }}
              transition={live ? { duration: 1.6, repeat: Infinity } : { duration: 0.3 }}
            />
            <circle cx={100} cy={28} r={6.5} fill={BULB} opacity={0.4 + 0.6 * power} />
            <circle cx={98} cy={26} r={1.8} fill={SHINE} opacity={0.8} />
          </Joint>

          <rect x={56} y={48} width={88} height={72} rx={28} fill={STEEL} />
          <Gloss cx={75} cy={57} rx={12} ry={4.5} rotate={-12} />
          <rect x={66} y={59} width={68} height={50} rx={19} fill={SCREEN} />
          {live && (
            <motion.rect
              x={66}
              width={68}
              height={3}
              fill={GLOW}
              opacity={0.08}
              animate={{ y: [60, 104] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
            />
          )}
          <path d="M73 66 Q78 62 88 62" stroke={SHINE} strokeOpacity={0.2} strokeWidth={3} fill="none" strokeLinecap="round" />
          <g opacity={0.4 + 0.6 * power}>
            <Cheeks mood={mood} left={[75, 97]} right={[125, 97]} rx={5} />
            <Eyes mood={mood} gaze={gaze} blinking={blinking} left={[87, 82]} right={[113, 82]} size={8.5} style="screen" colour={GLOW} />
            <Mouth shape={mouth} cx={100} cy={98} width={14} fill={GLOW} tongue={null} />
          </g>
        </Follow>
      </Joint>

      <Joint move={moves.armL} at={[71, 134]}>
        <path d="M71 134 C62 140 58 150 60 159" stroke={DEEP} strokeWidth={6} fill="none" strokeLinecap="round" />
        <circle cx={60} cy={163} r={7} fill={STEEL} />
        <path d="M55.5 166.5 Q60 162 64.5 166.5" stroke={DEEP} strokeWidth={2} fill="none" strokeLinecap="round" />
      </Joint>
      <Joint move={moves.armR} at={[129, 134]}>
        <path d="M129 134 C138 140 142 150 140 159" stroke={DEEP} strokeWidth={6} fill="none" strokeLinecap="round" />
        <circle cx={140} cy={163} r={7} fill={STEEL} />
        <path d="M135.5 166.5 Q140 162 144.5 166.5" stroke={DEEP} strokeWidth={2} fill="none" strokeLinecap="round" />
      </Joint>
    </Frame>
  )
}
