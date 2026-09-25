/** Kiko the kancil — the clever little mouse-deer of Malay folk tales, with a
 *  leaf sprout that bobs when Kiko moves. */
import { Frame, Joint } from './Rig'
import { Cheeks, Eyes, Follow, Gloss, Mouth } from '../parts'
import { BLUSH, INK, paint, SHINE } from '../paint'
import type { RigProps } from '../types'

const FUR = paint('kiko')
const DEEP = paint('kiko-deep')
const CREAM = paint('kiko-cream')
const LEAF = paint('kiko-leaf')

export function KikoRig({ mood, mouth, moves, gaze, blinking }: RigProps) {
  return (
    <Frame moves={moves} shadow={38}>
      <Joint move={moves.tail} at={[127, 154]}>
        <path d="M124 156 C127 143 137 134 146 137 C149 146 141 156 128 160 Z" fill={FUR} />
        <path d="M139 137.5 C144 135 148.5 138 147 143.5 C143.5 142.5 140.5 140.5 139 137.5 Z" fill={CREAM} />
      </Joint>

      <path d="M86 166 L85 181" stroke={FUR} strokeWidth={9} strokeLinecap="round" />
      <path d="M114 166 L115 181" stroke={FUR} strokeWidth={9} strokeLinecap="round" />
      <ellipse cx={85} cy={184} rx={6.5} ry={4} fill={DEEP} />
      <ellipse cx={115} cy={184} rx={6.5} ry={4} fill={DEEP} />

      <ellipse cx={100} cy={148} rx={31} ry={27} fill={FUR} />
      <ellipse cx={100} cy={158} rx={19} ry={15} fill={CREAM} />
      {/* The pale throat bib of a real kancil. */}
      <path d="M85 127 Q100 135 115 127 Q113 141 100 147 Q87 141 85 127 Z" fill={CREAM} />

      <Joint move={moves.head} at={[100, 126]}>
        <Follow gaze={gaze}>
          <Joint move={moves.earL} at={[80, 62]}>
            <path d="M80 66 C62 60 44 40 48 22 C62 20 82 38 88 56 Z" fill={FUR} />
            <path d="M78 59 C66 53 55 41 55 30 C64 31 76 43 81 53 Z" fill={BLUSH} opacity={0.75} />
          </Joint>
          <Joint move={moves.earR} at={[120, 62]}>
            <path d="M120 66 C138 60 156 40 152 22 C138 20 118 38 112 56 Z" fill={FUR} />
            <path d="M122 59 C134 53 145 41 145 30 C136 31 124 43 119 53 Z" fill={BLUSH} opacity={0.75} />
          </Joint>

          <Joint move={moves.extra} at={[101, 50]}>
            <path d="M101 51 C101 45 103 40 106 36" stroke={LEAF} strokeWidth={2.8} fill="none" strokeLinecap="round" />
            <path d="M106 36 C108 27 119 24 124 27 C121 34 114 40 106 36 Z" fill={LEAF} />
            <path d="M108 34 C112 31 116 29 120 28" stroke={SHINE} strokeOpacity={0.55} strokeWidth={1.2} fill="none" strokeLinecap="round" />
          </Joint>

          <ellipse cx={100} cy={86} rx={42} ry={38} fill={FUR} />
          <path d="M91 51 Q100 47 109 51 L104.5 90 Q100 93 95.5 90 Z" fill={DEEP} opacity={0.22} />
          <path d="M93 50 Q97 43 100 49 Q103 42 107 50" stroke={FUR} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Gloss cx={78} cy={62} rx={11} ry={5.5} />

          <ellipse cx={100} cy={104} rx={21} ry={14} fill={CREAM} />
          <Cheeks mood={mood} left={[71, 99]} right={[129, 99]} rx={7} />
          <Eyes mood={mood} gaze={gaze} blinking={blinking} left={[83, 83]} right={[117, 83]} size={8.5} />

          <path d="M93.5 96 Q100 92.5 106.5 96 Q104 102 100 102.5 Q96 102 93.5 96 Z" fill={INK} />
          <circle cx={97.6} cy={96.2} r={1.3} fill={SHINE} />
          <path d="M100 102.5 L100 105.5" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          <Mouth shape={mouth} cx={100} cy={108.5} width={13} />
        </Follow>
      </Joint>

      <Joint move={moves.armL} at={[77, 138]}>
        <path d="M77 138 C71 146 69 154 70 162" stroke={FUR} strokeWidth={9} fill="none" strokeLinecap="round" />
        <ellipse cx={70} cy={165} rx={5.5} ry={4.6} fill={DEEP} />
      </Joint>
      <Joint move={moves.armR} at={[123, 138]}>
        <path d="M123 138 C129 146 131 154 130 162" stroke={FUR} strokeWidth={9} fill="none" strokeLinecap="round" />
        <ellipse cx={130} cy={165} rx={5.5} ry={4.6} fill={DEEP} />
      </Joint>
    </Frame>
  )
}
