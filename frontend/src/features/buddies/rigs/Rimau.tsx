/** Rimau the Malayan tiger cub — brave, bouncy, and very proud of a roar that
 *  is mostly a squeak. */
import { Frame, Joint } from './Rig'
import { Cheeks, Eyes, Follow, Gloss, Mouth } from '../parts'
import { paint, SHINE } from '../paint'
import type { RigProps } from '../types'

const FUR = paint('rimau')
const DEEP = paint('rimau-deep')
const CREAM = paint('rimau-cream')
const STRIPE = paint('rimau-stripe')
const NOSE = paint('rimau-nose')

const TAIL = 'M121 170 C146 176 162 160 160 135'

function Stripes({ d }: { d: string[] }) {
  return (
    <g stroke={STRIPE} strokeWidth={3.2} fill="none" strokeLinecap="round">
      {d.map((path) => (
        <path key={path} d={path} />
      ))}
    </g>
  )
}

export function RimauRig({ mood, mouth, moves, gaze, blinking }: RigProps) {
  return (
    <Frame moves={moves} shadow={40}>
      <Joint move={moves.tail} at={[124, 166]}>
        <path d={TAIL} stroke={FUR} strokeWidth={10} fill="none" strokeLinecap="round" />
        <path d={TAIL} stroke={STRIPE} strokeWidth={10} fill="none" strokeDasharray="4 9" strokeDashoffset={-10} />
        <circle cx={160} cy={134} r={5.3} fill={STRIPE} />
      </Joint>

      <ellipse cx={87} cy={180} rx={11} ry={8} fill={FUR} />
      <ellipse cx={113} cy={180} rx={11} ry={8} fill={FUR} />
      <g stroke={DEEP} strokeWidth={1.6} strokeLinecap="round">
        <path d="M84 183 L84 187 M90 183 L90 187 M110 183 L110 187 M116 183 L116 187" />
      </g>

      <ellipse cx={100} cy={150} rx={31} ry={28} fill={FUR} />
      <ellipse cx={100} cy={157} rx={18} ry={18} fill={CREAM} />
      <Stripes d={['M71 142 Q77 144 80 139', 'M70 153 Q77 155 80 150', 'M129 142 Q123 144 120 139', 'M130 153 Q123 155 120 150']} />

      <Joint move={moves.head} at={[100, 128]}>
        <Follow gaze={gaze}>
          <Joint move={moves.earL} at={[68, 62]}>
            <circle cx={66} cy={56} r={15} fill={FUR} />
            <circle cx={66} cy={57} r={8.5} fill={CREAM} />
          </Joint>
          <Joint move={moves.earR} at={[132, 62]}>
            <circle cx={134} cy={56} r={15} fill={FUR} />
            <circle cx={134} cy={57} r={8.5} fill={CREAM} />
          </Joint>

          <ellipse cx={100} cy={88} rx={48} ry={40} fill={FUR} />
          <Gloss cx={76} cy={60} rx={12} ry={5} />
          <path d="M60 94 L50 99 L58 102 L52 108 L62 108 L60 114 C70 118 80 118 86 116 L86 100 Q72 92 60 94 Z" fill={CREAM} />
          <path d="M140 94 L150 99 L142 102 L148 108 L138 108 L140 114 C130 118 120 118 114 116 L114 100 Q128 92 140 94 Z" fill={CREAM} />
          <ellipse cx={91} cy={106} rx={11} ry={8.5} fill={CREAM} />
          <ellipse cx={109} cy={106} rx={11} ry={8.5} fill={CREAM} />
          <ellipse cx={100} cy={114} rx={8} ry={5} fill={CREAM} />

          <path d="M93.5 49 Q100 57 106.5 49 Q103.5 62 100 64 Q96.5 62 93.5 49 Z" fill={STRIPE} />
          <Stripes
            d={[
              'M75 57 Q81 61 81 69',
              'M125 57 Q119 61 119 69',
              'M52.5 82 L63 85',
              'M53 90.5 L63 91',
              'M147.5 82 L137 85',
              'M147 90.5 L137 91',
            ]}
          />

          <Cheeks mood={mood} left={[72, 100]} right={[128, 100]} rx={6} />
          <Eyes mood={mood} gaze={gaze} blinking={blinking} left={[82, 84]} right={[118, 84]} size={9} />
          <g fill={DEEP} opacity={0.5}>
            <circle cx={86} cy={107} r={1.2} />
            <circle cx={83.5} cy={111} r={1.2} />
            <circle cx={114} cy={107} r={1.2} />
            <circle cx={116.5} cy={111} r={1.2} />
          </g>
          <path d="M94 98 Q100 95 106 98 Q103 103.5 100 104 Q97 103.5 94 98 Z" fill={NOSE} />
          <circle cx={97.8} cy={98.3} r={1.2} fill={SHINE} />
          <Mouth shape={mouth} cx={100} cy={110} width={13} />
        </Follow>
      </Joint>

      <Joint move={moves.armL} at={[77, 142]}>
        <path d="M77 142 C71 149 69 156 70 162" stroke={FUR} strokeWidth={11} fill="none" strokeLinecap="round" />
        <ellipse cx={70} cy={166} rx={3.6} ry={2.7} fill={CREAM} />
      </Joint>
      <Joint move={moves.armR} at={[123, 142]}>
        <path d="M123 142 C129 149 131 156 130 162" stroke={FUR} strokeWidth={11} fill="none" strokeLinecap="round" />
        <ellipse cx={130} cy={166} rx={3.6} ry={2.7} fill={CREAM} />
      </Joint>
    </Frame>
  )
}
