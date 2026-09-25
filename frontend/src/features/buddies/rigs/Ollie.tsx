/** Ollie the owl — round, wise and kind, with glasses that slide down the
 *  beak while Ollie thinks. */
import { Frame, Joint } from './Rig'
import { Cheeks, Eyes, Follow, Gloss, Mouth } from '../parts'
import { INK, paint, SHINE } from '../paint'
import type { RigProps } from '../types'

const FEATHER = paint('ollie')
const DEEP = paint('ollie-deep')
const BELLY = paint('ollie-belly')
const BEAK = paint('ollie-beak')
const IRIS = paint('ollie-iris')

const SCALLOPS = [
  'M82 136 q4.5 5 9 0 q4.5 5 9 0 q4.5 5 9 0 q4.5 5 9 0',
  'M79 147 q4.2 5 8.4 0 q4.2 5 8.4 0 q4.2 5 8.4 0 q4.2 5 8.4 0 q4.2 5 8.4 0',
  'M84 158 q4 4.5 8 0 q4 4.5 8 0 q4 4.5 8 0 q4 4.5 8 0',
]

function Toes({ x }: { x: number }) {
  return (
    <g fill={BEAK}>
      <ellipse cx={x - 6} cy={184} rx={3.6} ry={3} />
      <ellipse cx={x} cy={185} rx={3.6} ry={3.2} />
      <ellipse cx={x + 6} cy={184} rx={3.6} ry={3} />
    </g>
  )
}

export function OllieRig({ mood, mouth, moves, gaze, blinking }: RigProps) {
  return (
    <Frame moves={moves} shadow={42}>
      <Toes x={86} />
      <Toes x={114} />

      <Joint move={moves.armL} at={[56, 118]}>
        <path d="M58 112 C40 124 38 148 48 166 C55 158 61 142 64 124 Z" fill={DEEP} />
        <path d="M50 150 L56 142 M47 138 L55 132" stroke={FEATHER} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
      </Joint>
      <Joint move={moves.armR} at={[144, 118]}>
        <path d="M142 112 C160 124 162 148 152 166 C145 158 139 142 136 124 Z" fill={DEEP} />
        <path d="M150 150 L144 142 M153 138 L145 132" stroke={FEATHER} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
      </Joint>

      <ellipse cx={100} cy={140} rx={46} ry={44} fill={FEATHER} />
      <ellipse cx={100} cy={149} rx={30} ry={31} fill={BELLY} />
      {SCALLOPS.map((d) => (
        <path key={d} d={d} stroke={FEATHER} strokeOpacity={0.45} strokeWidth={2} fill="none" strokeLinecap="round" />
      ))}

      <Joint move={moves.head} at={[100, 128]}>
        <Follow gaze={gaze}>
          <Joint move={moves.earL} at={[72, 56]}>
            <path d="M64 62 C58 48 56 36 58 24 C68 34 78 44 84 54 Z" fill={DEEP} />
          </Joint>
          <Joint move={moves.earR} at={[128, 56]}>
            <path d="M136 62 C142 48 144 36 142 24 C132 34 122 44 116 54 Z" fill={DEEP} />
          </Joint>

          <ellipse cx={100} cy={86} rx={50} ry={43} fill={FEATHER} />
          <Gloss cx={72} cy={58} rx={12} ry={5.5} />
          <circle cx={81} cy={87} r={23} fill={BELLY} />
          <circle cx={119} cy={87} r={23} fill={BELLY} />
          <path d="M86 64 Q100 74 114 64" stroke={DEEP} strokeWidth={3.2} fill="none" strokeLinecap="round" />
          <Cheeks mood={mood} left={[64, 106]} right={[136, 106]} rx={6} />
          <Eyes mood={mood} gaze={gaze} blinking={blinking} left={[81, 87]} right={[119, 87]} size={10} style="owl" iris={IRIS} />

          <Mouth shape={mouth} cx={100} cy={109} width={11} />
          <path d="M91.5 98 Q100 93.5 108.5 98 L100 111 Z" fill={BEAK} strokeLinejoin="round" stroke={BEAK} strokeWidth={1.5} />
          <path d="M95 98 Q100 96 105 98" stroke={SHINE} strokeOpacity={0.5} strokeWidth={1.3} fill="none" strokeLinecap="round" />

          <Joint move={moves.extra} at={[100, 87]}>
            <g stroke={INK} strokeWidth={2.6} fill="none">
              <circle cx={81} cy={87} r={16} />
              <circle cx={119} cy={87} r={16} />
              <path d="M97 85 Q100 81.5 103 85" strokeLinecap="round" />
            </g>
            <path d="M71 80 Q74 75 79 74" stroke={SHINE} strokeOpacity={0.7} strokeWidth={2} fill="none" strokeLinecap="round" />
            <path d="M109 80 Q112 75 117 74" stroke={SHINE} strokeOpacity={0.7} strokeWidth={2} fill="none" strokeLinecap="round" />
          </Joint>
        </Follow>
      </Joint>
    </Frame>
  )
}
