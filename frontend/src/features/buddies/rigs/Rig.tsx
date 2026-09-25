/**
 * The frame every rig hangs its drawing on: the ground shadow, the turn about
 * the middle, and the body pivoting on its feet. A rig supplies what sits in
 * that frame; the frame makes it jump, spin and breathe.
 */
import { motion } from 'motion/react'
import { paint, pivot } from '../paint'
import type { Moves } from '../types'

export function Frame({
  moves,
  feet = 186,
  ground = feet + 2,
  middle = 124,
  shadow = 40,
  children,
}: {
  moves: Moves
  /** Where the body pivots — its feet. */
  feet?: number
  /** Where the shadow falls, if not right under the feet (Bolt hovers). */
  ground?: number
  middle?: number
  shadow?: number
  children: React.ReactNode
}) {
  return (
    <g>
      <motion.ellipse
        cx={100}
        cy={ground}
        rx={shadow}
        ry={shadow * 0.15}
        fill={paint('ground')}
        opacity={0.16}
        initial={false}
        animate={moves.shadow}
        style={pivot(100, ground)}
      />
      <motion.g initial={false} animate={moves.spin} style={pivot(100, middle)}>
        <motion.g initial={false} animate={moves.body} style={pivot(100, feet)}>
          {children}
        </motion.g>
      </motion.g>
    </g>
  )
}

/** A part that turns about a point: an arm at the shoulder, an ear at its root. */
export function Joint({
  move,
  at,
  children,
}: {
  move: Moves[keyof Moves]
  at: readonly [number, number]
  children: React.ReactNode
}) {
  return (
    <motion.g initial={false} animate={move} style={pivot(at[0], at[1])}>
      {children}
    </motion.g>
  )
}
