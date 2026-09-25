/** Momo the baby dragon — soft mint scales, wings too small to fly with yet,
 *  and a puff of flame that comes out as sparkles. */
import { Frame, Joint } from './Rig'
import { mirrored } from '../choreography'
import { Cheeks, Eyes, Follow, Gloss, Mouth } from '../parts'
import { paint, SHINE } from '../paint'
import type { RigProps } from '../types'

const SCALE = paint('momo')
const DEEP = paint('momo-deep')
const BELLY = paint('momo-belly')
const WING = paint('momo-wing')
const HORN = paint('momo-horn')

function Claws({ x }: { x: number }) {
  return (
    <g fill={HORN}>
      <circle cx={x - 5} cy={185.5} r={1.9} />
      <circle cx={x} cy={186.5} r={1.9} />
      <circle cx={x + 5} cy={185.5} r={1.9} />
    </g>
  )
}

export function MomoRig({ mood, mouth, moves, gaze, blinking }: RigProps) {
  return (
    <Frame moves={moves} shadow={38}>
      <Joint move={moves.tail} at={[122, 168]}>
        <path d="M116 172 C140 178 158 170 162 150" stroke={SCALE} strokeWidth={11} fill="none" strokeLinecap="round" />
        <path d="M162 133 C171 138 173 147 162 153 C151 147 153 138 162 133 Z" fill={WING} />
      </Joint>

      <Joint move={moves.extra} at={[80, 132]}>
        <path d="M80 132 C66 112 48 106 36 114 C43 119 45 125 43 132 C50 129 56 133 56 140 C62 136 70 138 78 142 Z" fill={WING} />
        <path d="M78 134 L47 118 M78 138 L56 133" stroke={DEEP} strokeOpacity={0.22} strokeWidth={1.8} strokeLinecap="round" />
      </Joint>
      <Joint move={mirrored(moves.extra)} at={[120, 132]}>
        <path d="M120 132 C134 112 152 106 164 114 C157 119 155 125 157 132 C150 129 144 133 144 140 C138 136 130 138 122 142 Z" fill={WING} />
        <path d="M122 134 L153 118 M122 138 L144 133" stroke={DEEP} strokeOpacity={0.22} strokeWidth={1.8} strokeLinecap="round" />
      </Joint>

      <ellipse cx={86} cy={180} rx={10} ry={8} fill={SCALE} />
      <ellipse cx={114} cy={180} rx={10} ry={8} fill={SCALE} />
      <Claws x={86} />
      <Claws x={114} />

      <ellipse cx={100} cy={150} rx={30} ry={28} fill={SCALE} />
      <ellipse cx={100} cy={157} rx={19} ry={19} fill={BELLY} />
      <g stroke={DEEP} strokeOpacity={0.18} strokeWidth={1.8} fill="none" strokeLinecap="round">
        <path d="M84 149 Q100 153 116 149" />
        <path d="M82.5 159 Q100 163 117.5 159" />
        <path d="M86 168 Q100 171 114 168" />
      </g>

      <Joint move={moves.head} at={[100, 128]}>
        <Follow gaze={gaze}>
          <path d="M76 58 C70 46 70 34 76 25 C80 35 86 44 91 52 Z" fill={HORN} />
          <path d="M124 58 C130 46 130 34 124 25 C120 35 114 44 109 52 Z" fill={HORN} />
          <path d="M91 50 L95.5 38 L100 47 L104.5 37 L109 50 Z" fill={WING} strokeLinejoin="round" stroke={WING} strokeWidth={2} />

          <Joint move={moves.earL} at={[62, 84]}>
            <path d="M63 78 C51 69 42 71 37 77 C43 80 43 86 39 90 C47 93 56 91 63 88 Z" fill={WING} />
          </Joint>
          <Joint move={moves.earR} at={[138, 84]}>
            <path d="M137 78 C149 69 158 71 163 77 C157 80 157 86 161 90 C153 93 144 91 137 88 Z" fill={WING} />
          </Joint>

          <ellipse cx={100} cy={86} rx={43} ry={39} fill={SCALE} />
          <Gloss cx={78} cy={60} rx={11} ry={5} />
          <g fill={DEEP} opacity={0.2}>
            <circle cx={86} cy={61} r={2} />
            <circle cx={93} cy={57} r={1.6} />
            <circle cx={112} cy={60} r={2} />
          </g>
          <ellipse cx={100} cy={104} rx={22} ry={13} fill={SHINE} opacity={0.28} />
          <ellipse cx={93} cy={99} rx={2.1} ry={1.5} fill={DEEP} />
          <ellipse cx={107} cy={99} rx={2.1} ry={1.5} fill={DEEP} />
          <Cheeks mood={mood} left={[68, 100]} right={[132, 100]} rx={7} colour={WING} />
          <Eyes mood={mood} gaze={gaze} blinking={blinking} left={[83, 84]} right={[117, 84]} size={9.5} />
          <Mouth shape={mouth} cx={100} cy={110} width={14} />
        </Follow>
      </Joint>

      <Joint move={moves.armL} at={[77, 144]}>
        <path d="M77 144 C71 150 69 156 70 162" stroke={SCALE} strokeWidth={9} fill="none" strokeLinecap="round" />
        <circle cx={70} cy={165} r={2} fill={HORN} />
      </Joint>
      <Joint move={moves.armR} at={[123, 144]}>
        <path d="M123 144 C129 150 131 156 130 162" stroke={SCALE} strokeWidth={9} fill="none" strokeLinecap="round" />
        <circle cx={130} cy={165} r={2} fill={HORN} />
      </Joint>
    </Frame>
  )
}
