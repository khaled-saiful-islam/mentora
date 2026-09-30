/** Momo the baby orangutan — from the rainforests of Borneo: shaggy orange
 *  fur, a tuft of hair that sticks straight up, a round peach face, and
 *  arms long enough for the biggest hugs. When it rains, Momo holds a big
 *  leaf over their head, the way real orangutans do. */
import { AnimatePresence, motion } from 'motion/react'
import { spring } from '@/motion'
import { Frame, Joint } from './Rig'
import { Cheeks, Eyes, Follow, Gloss, Mouth } from '../parts'
import { INK, paint, pivot, SHINE } from '../paint'
import type { RigProps } from '../types'

const FUR = paint('momo')
const DEEP = paint('momo-deep')
const FACE = paint('momo-face')
const LEAF = paint('momo-leaf')

/** Four fingers at the end of a long arm, peach like the face. */
function Hand({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={6.5} ry={5.5} fill={FACE} />
      <path d={`M${x - 4} ${y + 3} l0 3 M${x - 1.3} ${y + 4} l0 3 M${x + 1.3} ${y + 4} l0 3 M${x + 4} ${y + 3} l0 3`} stroke={DEEP} strokeOpacity={0.35} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )
}

export function MomoRig({ mood, mouth, moves, gaze, blinking }: RigProps) {
  return (
    <Frame moves={moves} shadow={40}>
      {/* The leaf umbrella: only out for the trick, held up high. */}
      <AnimatePresence>
        {mood === 'trick' && (
          <motion.g
            key="umbrella"
            style={pivot(144, 100)}
            initial={{ scale: 0.2, opacity: 0, rotate: 20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.2, opacity: 0, rotate: 20, transition: { duration: 0.25 } }}
            transition={spring.bouncy}
          >
            <path d="M144 100 C142 80 134 60 118 44" stroke={DEEP} strokeWidth={2.6} fill="none" strokeLinecap="round" />
            <path d="M58 46 C70 18 132 8 156 40 C146 36 138 40 132 46 C124 38 112 38 106 46 C98 38 86 38 80 46 C74 40 64 40 58 46 Z" fill={LEAF} />
            <path d="M68 40 C88 22 124 18 146 36" stroke={SHINE} strokeOpacity={0.5} strokeWidth={1.8} fill="none" strokeLinecap="round" />
            <path d="M106 46 L108 22 M80 46 L88 28 M132 46 L128 26" stroke={DEEP} strokeOpacity={0.25} strokeWidth={1.4} strokeLinecap="round" />
          </motion.g>
        )}
      </AnimatePresence>

      <ellipse cx={87} cy={180} rx={10} ry={7} fill={FUR} />
      <ellipse cx={113} cy={180} rx={10} ry={7} fill={FUR} />
      <ellipse cx={86} cy={184} rx={7} ry={3.6} fill={FACE} />
      <ellipse cx={114} cy={184} rx={7} ry={3.6} fill={FACE} />

      <ellipse cx={100} cy={150} rx={31} ry={30} fill={FUR} />
      <ellipse cx={100} cy={157} rx={18} ry={18} fill={FACE} opacity={0.85} />
      {/* Shaggy fur along the sides. */}
      <g stroke={DEEP} strokeOpacity={0.28} strokeWidth={1.8} fill="none" strokeLinecap="round">
        <path d="M72 142 q-3 5 0 10 M73 156 q-3 5 0 10" />
        <path d="M128 142 q3 5 0 10 M127 156 q3 5 0 10" />
      </g>

      <Joint move={moves.head} at={[100, 124]}>
        <Follow gaze={gaze}>
          <Joint move={moves.earL} at={[60, 88]}>
            <circle cx={60} cy={88} r={8.5} fill={FUR} />
            <circle cx={60} cy={88} r={4.5} fill={FACE} />
          </Joint>
          <Joint move={moves.earR} at={[140, 88]}>
            <circle cx={140} cy={88} r={8.5} fill={FUR} />
            <circle cx={140} cy={88} r={4.5} fill={FACE} />
          </Joint>

          <ellipse cx={100} cy={86} rx={40} ry={37} fill={FUR} />
          {/* The famous tuft: hair that will not lie down. */}
          <Joint move={moves.extra} at={[100, 52]}>
            <path d="M88 54 C84 42 86 32 92 26 C92 36 95 44 98 50 C98 38 102 28 110 22 C108 34 107 44 106 52 C110 44 116 40 122 40 C118 46 114 52 112 56 Z" fill={FUR} />
            <path d="M92 50 C91 42 92 36 94 31 M104 49 C104 40 106 33 109 28" stroke={DEEP} strokeOpacity={0.25} strokeWidth={1.4} fill="none" strokeLinecap="round" />
          </Joint>
          <Gloss cx={76} cy={64} rx={10} ry={5} />

          {/* A round peach face with a soft muzzle. */}
          <path d="M100 62 C84 58 68 66 68 84 C68 104 82 120 100 120 C118 120 132 104 132 84 C132 66 116 58 100 62 Z" fill={FACE} />
          <ellipse cx={100} cy={106} rx={17} ry={11} fill={SHINE} opacity={0.35} />
          <Cheeks mood={mood} left={[74, 100]} right={[126, 100]} rx={6.5} />
          <Eyes mood={mood} gaze={gaze} blinking={blinking} left={[86, 84]} right={[114, 84]} size={9} />
          <ellipse cx={96.5} cy={100} rx={1.7} ry={1.3} fill={INK} opacity={0.7} />
          <ellipse cx={103.5} cy={100} rx={1.7} ry={1.3} fill={INK} opacity={0.7} />
          <Mouth shape={mouth} cx={100} cy={109} width={15} />
        </Follow>
      </Joint>

      {/* Long arms, down to the knees. */}
      <Joint move={moves.armL} at={[75, 136]}>
        <path d="M75 136 C66 146 63 160 66 172" stroke={FUR} strokeWidth={10} fill="none" strokeLinecap="round" />
        <Hand x={66} y={174} />
      </Joint>
      <Joint move={moves.armR} at={[125, 136]}>
        <path d="M125 136 C134 146 137 160 134 172" stroke={FUR} strokeWidth={10} fill="none" strokeLinecap="round" />
        <Hand x={134} y={174} />
      </Joint>
    </Frame>
  )
}
