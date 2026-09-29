/** Tompok the cat — a soft grey kampung cat with one dark patch over her eye
 *  (that is what "tompok" means), a red collar and a little gold bell that
 *  jingles when she moves. Curious, cosy, and very proud of her tail. */
import { Frame, Joint } from './Rig'
import { Cheeks, Eyes, Follow, Gloss, Mouth } from '../parts'
import { BLUSH, INK, paint, SHINE } from '../paint'
import type { RigProps } from '../types'

const FUR = paint('tompok')
const DEEP = paint('tompok-deep')
const CREAM = paint('tompok-cream')
const PINK = paint('tompok-pink')
const COLLAR = paint('tompok-collar')
const BELL = paint('tompok-bell')

const TAIL = 'M122 170 C150 172 164 150 156 124 C153 114 146 110 142 114'

export function TompokRig({ mood, mouth, moves, gaze, blinking }: RigProps) {
  return (
    <Frame moves={moves} shadow={38}>
      <Joint move={moves.tail} at={[124, 168]}>
        <path d={TAIL} stroke={FUR} strokeWidth={10} fill="none" strokeLinecap="round" />
        {/* The white tip every good kampung cat has. */}
        <path d="M150 117 C147 112 144 111 142 114" stroke={CREAM} strokeWidth={10} fill="none" strokeLinecap="round" />
        <path d="M131 171 Q139 170 145 165 M150 156 Q155 150 156 142" stroke={DEEP} strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.55} />
      </Joint>

      <ellipse cx={87} cy={181} rx={10.5} ry={7.5} fill={FUR} />
      <ellipse cx={113} cy={181} rx={10.5} ry={7.5} fill={FUR} />
      <ellipse cx={87} cy={183} rx={6} ry={3.6} fill={CREAM} />
      <ellipse cx={113} cy={183} rx={6} ry={3.6} fill={CREAM} />

      <ellipse cx={100} cy={151} rx={30} ry={27} fill={FUR} />
      <ellipse cx={100} cy={158} rx={17} ry={18} fill={CREAM} />

      <Joint move={moves.head} at={[100, 128]}>
        <Follow gaze={gaze}>
          <Joint move={moves.earL} at={[72, 64]}>
            <path d="M60 70 L62 30 L90 56 Z" fill={FUR} strokeLinejoin="round" />
            <path d="M66 62 L67 41 L83 56 Z" fill={PINK} />
          </Joint>
          <Joint move={moves.earR} at={[128, 64]}>
            <path d="M140 70 L138 30 L110 56 Z" fill={FUR} strokeLinejoin="round" />
            <path d="M134 62 L133 41 L117 56 Z" fill={PINK} />
          </Joint>

          <ellipse cx={100} cy={88} rx={45} ry={38} fill={FUR} />
          {/* Her tompok: the dark patch over her left eye. */}
          <path d="M64 70 C70 60 88 60 96 68 C98 80 92 94 80 96 C68 96 60 84 64 70 Z" fill={DEEP} opacity={0.7} />
          <path d="M94 54 L96 64 M100 52 L100 63 M106 54 L104 64" stroke={DEEP} strokeWidth={2.6} strokeLinecap="round" opacity={0.6} />
          <Gloss cx={118} cy={62} rx={11} ry={5} />

          <ellipse cx={91} cy={106} rx={11.5} ry={8.5} fill={CREAM} />
          <ellipse cx={109} cy={106} rx={11.5} ry={8.5} fill={CREAM} />
          <ellipse cx={100} cy={112} rx={8} ry={5} fill={CREAM} />

          <Cheeks mood={mood} left={[70, 100]} right={[130, 100]} rx={6} />
          <Eyes mood={mood} gaze={gaze} blinking={blinking} left={[82, 83]} right={[118, 83]} size={9} />

          <g stroke={INK} strokeWidth={1.3} strokeLinecap="round" opacity={0.45}>
            <path d="M84 104 L62 100 M84 108 L61 109 M85 112 L64 117" />
            <path d="M116 104 L138 100 M116 108 L139 109 M115 112 L136 117" />
          </g>
          <path d="M95 98 L105 98 L100 104 Z" fill={BLUSH} stroke={BLUSH} strokeWidth={2} strokeLinejoin="round" />
          <circle cx={98.2} cy={98.8} r={1.1} fill={SHINE} />
          <Mouth shape={mouth} cx={100} cy={109} width={13} />
        </Follow>
      </Joint>

      {/* The collar, and the bell that swings on it. */}
      <path d="M76 126 Q100 136 124 126" stroke={COLLAR} strokeWidth={6} fill="none" strokeLinecap="round" />
      <Joint move={moves.extra} at={[100, 131]}>
        <circle cx={100} cy={138} r={6} fill={BELL} />
        <path d="M95 139 L105 139" stroke={DEEP} strokeWidth={1.3} strokeLinecap="round" opacity={0.6} />
        <circle cx={100} cy={141.5} r={1.4} fill={DEEP} opacity={0.7} />
        <circle cx={98} cy={136} r={1.3} fill={SHINE} opacity={0.8} />
      </Joint>

      <Joint move={moves.armL} at={[77, 142]}>
        <path d="M77 142 C71 149 69 156 70 162" stroke={FUR} strokeWidth={11} fill="none" strokeLinecap="round" />
        <ellipse cx={70} cy={166} rx={4} ry={3} fill={CREAM} />
      </Joint>
      <Joint move={moves.armR} at={[123, 142]}>
        <path d="M123 142 C129 149 131 156 130 162" stroke={FUR} strokeWidth={11} fill="none" strokeLinecap="round" />
        <ellipse cx={130} cy={166} rx={4} ry={3} fill={CREAM} />
      </Joint>
    </Frame>
  )
}
