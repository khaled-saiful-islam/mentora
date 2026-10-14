/**
 * The animated "how to play" demos (§26.8): a little hand plays one move of
 * each template in a miniature of it, in three phases that match the three
 * steps beside it — where to look, the move, what right looks like. Pictures
 * only (`aria-hidden`): the steps say it in words.
 */
import { motion } from 'motion/react'
import { Check, HandPointing, LockKey, LockKeyOpen } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { Play } from '../types'

export type Phase = 0 | 1 | 2

interface DemoProps {
  phase: Phase
}

const MOVE = { type: 'spring', stiffness: 120, damping: 18 } as const

/** Where the hand is, in percent of the stage. */
function Hand({ x, y, pressing }: { x: number; y: number; pressing?: boolean }) {
  return (
    <motion.span
      className="pointer-events-none absolute z-20 -translate-x-1/4"
      initial={false}
      animate={{ left: `${x}%`, top: `${y}%`, scale: pressing ? 0.85 : 1 }}
      transition={MOVE}
    >
      <HandPointing weight="fill" className="size-9 text-primary drop-shadow" />
    </motion.span>
  )
}

/** A piece that moves about the stage. */
function Piece({ x, y, className, children }: { x: number; y: number; className?: string; children: React.ReactNode }) {
  return (
    <motion.span
      className={cn('absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-xl border-2 bg-surface px-2 py-1 text-sm font-bold shadow-sm', className)}
      initial={false}
      animate={{ left: `${x}%`, top: `${y}%` }}
      transition={MOVE}
    >
      {children}
    </motion.span>
  )
}

function Tick({ show }: { show: boolean }) {
  return (
    <motion.span initial={false} animate={{ scale: show ? 1 : 0 }} transition={MOVE} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-correct text-white">
      <Check weight="bold" className="size-4" />
    </motion.span>
  )
}

function SortDemo({ phase }: DemoProps) {
  const dropped = phase === 2
  return (
    <>
      <Piece x={phase === 0 ? 50 : 26} y={phase === 0 ? 22 : 74} className={cn(dropped && 'scale-75 border-correct')}>🍌 Banana</Piece>
      {['🍎 Fruit', '🥕 Not fruit'].map((label, n) => (
        <span key={label} className={cn('absolute bottom-2 grid h-14 w-[42%] place-items-end justify-center rounded-xl border-2 border-dashed pb-1 text-xs font-bold', n === 0 ? 'left-[5%]' : 'right-[5%]', n === 0 && dropped ? 'border-correct bg-correct-soft' : 'border-border bg-surface/70')}>
          {label}
          {n === 0 && <Tick show={dropped} />}
        </span>
      ))}
      <Hand x={phase === 0 ? 52 : 28} y={phase === 0 ? 26 : 72} pressing={phase === 1} />
    </>
  )
}

function OrderDemo({ phase }: DemoProps) {
  const placed = phase === 0 ? 0 : phase === 1 ? 1 : 2
  const chips = [
    { label: '🌱 Grow', home: 72, slot: 50 },
    { label: '🌰 Seed', home: 22, slot: 20 },
  ]
  return (
    <>
      {[1, 2, 3].map((n) => (
        <span key={n} className={cn('absolute top-3 grid h-9 w-[28%] place-items-center rounded-lg border-2 border-dashed text-xs font-bold text-muted-foreground', n <= placed ? 'border-correct bg-correct-soft' : 'border-border bg-surface/70')} style={{ left: `${4 + (n - 1) * 32}%` }}>
          {n}
        </span>
      ))}
      {[chips[1], chips[0]].map((chip, n) => (
        <Piece key={chip.label} x={n < placed ? chip.slot - 2 + n * 4 : chip.home} y={n < placed ? 20 : 74} className={cn(n < placed && 'border-correct')}>
          {chip.label}
        </Piece>
      ))}
      <Piece x={46} y={74}>🌳 Tree</Piece>
      <Hand x={placed === 0 ? 24 : placed === 1 ? 74 : 54} y={placed === 0 ? 76 : placed === 1 ? 76 : 22} pressing={phase !== 0} />
    </>
  )
}

function MatchDemo({ phase }: DemoProps) {
  const filled = phase >= 1
  return (
    <>
      <span className="absolute left-[4%] top-4 rounded-xl border-2 border-border bg-surface px-2 py-1 text-sm font-bold">🐟 Fish</span>
      <span className={cn('absolute right-[4%] top-3 h-10 w-[46%] rounded-xl border-2 border-dashed', phase === 2 ? 'border-correct bg-correct-soft' : 'border-primary bg-selected')}>
        <Tick show={phase === 2} />
      </span>
      <Piece x={filled ? 73 : 32} y={filled ? 22 : 78} className={cn(phase === 2 && 'border-correct')}>swims</Piece>
      <Piece x={70} y={78}>flies</Piece>
      <Hand x={filled ? 75 : 34} y={filled ? 26 : 80} pressing={phase === 1} />
    </>
  )
}

function LabDemo({ phase }: DemoProps) {
  const level = [15, 55, 62][phase]
  const inZone = phase === 2
  return (
    <>
      <span className="absolute left-[6%] right-[6%] top-4 h-5 overflow-hidden rounded-full bg-surface/80">
        <span className="absolute inset-y-0 left-[50%] w-[22%] bg-correct-soft" />
        <motion.span className={cn('absolute inset-y-0 left-0', inZone ? 'bg-correct' : 'bg-primary')} initial={false} animate={{ width: `${level}%` }} transition={MOVE} />
      </span>
      <motion.span className="absolute left-1/2 top-12 -translate-x-1/2 text-3xl" initial={false} animate={{ scale: 0.6 + level / 100 }} transition={MOVE}>
        🌱
      </motion.span>
      <span className="absolute bottom-6 left-[8%] right-[8%] h-2 rounded-full bg-surface/80" />
      <motion.span className="absolute bottom-[14px] z-10 size-6 -translate-x-1/2 rounded-full border-2 border-surface bg-primary shadow" initial={false} animate={{ left: `${8 + phase * 38}%` }} transition={MOVE} />
      {inZone && <span className="absolute right-[6%] top-11 rounded-full bg-correct px-2 text-xs font-bold text-white">Goal!</span>}
      <Hand x={8 + phase * 38} y={64} pressing={phase === 1} />
    </>
  )
}

function MistakeDemo({ phase }: DemoProps) {
  const lines = ['1/2 + 1/4', '= 2/6', '= 3/4']
  return (
    <>
      {lines.map((line, n) => (
        <span key={line} className={cn('absolute left-[6%] w-[52%] rounded-lg px-2 py-0.5 text-sm font-bold', n === 1 && phase >= 1 ? 'bg-destructive/15 line-through' : 'bg-surface/80')} style={{ top: `${10 + n * 26}%` }}>
          {line}
        </span>
      ))}
      <motion.span initial={false} animate={{ opacity: phase >= 1 ? 1 : 0, x: phase >= 1 ? 0 : 12 }} className="absolute right-[5%] top-[18%] flex flex-col gap-1.5">
        {['= 3/4', '= 2/8'].map((fix, n) => (
          <span key={fix} className={cn('rounded-lg border-2 bg-surface px-2 py-0.5 text-sm font-bold', n === 0 && phase === 2 ? 'border-correct bg-correct-soft' : 'border-border')}>
            {fix}
          </span>
        ))}
      </motion.span>
      <Hand x={phase === 0 ? 30 : phase === 1 ? 22 : 74} y={phase === 2 ? 22 : 40} pressing={phase !== 0} />
    </>
  )
}

function CaseDemo({ phase }: DemoProps) {
  return (
    <>
      <motion.span initial={false} animate={{ rotateY: phase === 0 ? 180 : 0 }} transition={MOVE} className={cn('absolute left-[5%] top-3 w-[44%] rounded-xl border-2 bg-surface p-1.5 text-xs font-semibold', phase === 2 ? 'border-correct' : 'border-border')}>
        🔎 Size 5 boots by the gate
        <Tick show={phase === 2} />
      </motion.span>
      {['👦 Ali', '👧 Mei'].map((name, n) => (
        <span key={name} className={cn('absolute bottom-3 w-[30%] rounded-xl border-2 px-2 py-1 text-center text-sm font-bold', n === 0 && phase >= 1 ? 'border-correct bg-correct-soft' : 'border-border bg-surface')} style={{ right: `${5 + n * 33}%` }}>
          {name}
        </span>
      ))}
      <Hand x={phase === 0 ? 24 : phase === 1 ? 70 : 22} y={phase === 1 ? 72 : 22} pressing={phase !== 0} />
    </>
  )
}

function EscapeDemo({ phase }: DemoProps) {
  const code = ['1', '12', '12'][phase]
  const open = phase === 2
  return (
    <>
      <motion.span initial={false} animate={{ rotateY: open ? -55 : 0 }} transition={MOVE} style={{ transformOrigin: 'left' }} className="absolute left-[6%] top-3 grid h-[78%] w-[30%] place-items-center rounded-t-2xl border-4 border-border bg-surface">
        {open ? <LockKeyOpen weight="fill" className="size-7 text-success" /> : <LockKey weight="fill" className="size-7 text-muted-foreground" />}
      </motion.span>
      <span className="absolute right-[6%] top-3 w-[50%] rounded-lg bg-surface px-2 py-1 text-center font-display text-lg font-bold tabular-nums">{code}</span>
      <span className="absolute bottom-3 right-[6%] grid w-[50%] grid-cols-3 gap-1">
        {['1', '2', '3'].map((key) => (
          <span key={key} className="rounded-md border-2 border-border bg-surface text-center text-sm font-bold">{key}</span>
        ))}
      </span>
      <Hand x={phase === 0 ? 56 : 72} y={70} pressing={phase !== 2} />
    </>
  )
}

function BossDemo({ phase }: DemoProps) {
  const health = [100, 66, 66][phase]
  return (
    <>
      <motion.span initial={false} animate={{ x: phase === 1 ? [0, -6, 6, 0] : 0 }} className="absolute left-[8%] top-3 text-4xl">👾</motion.span>
      <span className="absolute left-[30%] right-[6%] top-6 h-3 overflow-hidden rounded-full bg-surface/80">
        <motion.span className="absolute inset-y-0 left-0 bg-destructive" initial={false} animate={{ width: `${health}%` }} transition={MOVE} />
      </span>
      {['🌧️ Rain', '🔥 Fire'].map((answer, n) => (
        <span key={answer} className={cn('absolute bottom-3 w-[42%] rounded-xl border-2 px-2 py-1 text-center text-sm font-bold', n === 0 && phase >= 1 ? 'border-correct bg-correct-soft' : 'border-border bg-surface')} style={{ left: `${6 + n * 46}%` }}>
          {answer}
        </span>
      ))}
      <Hand x={22} y={phase === 0 ? 50 : 72} pressing={phase === 1} />
    </>
  )
}

function SayDemo({ phase }: DemoProps) {
  return (
    <>
      <span className="absolute left-[12%] top-6 flex gap-2 text-xl font-bold">
        {['Ikan', 'berenang'].map((word, n) => (
          <span key={word} className={cn('rounded-xl border-2 px-2 py-0.5', phase >= n + 1 ? 'border-correct bg-correct-soft' : 'border-transparent bg-surface/80')}>
            {word}
          </span>
        ))}
      </span>
      <motion.span initial={false} animate={{ scale: phase >= 1 ? [1, 1.15, 1] : 1 }} transition={{ duration: 0.8, repeat: phase >= 1 ? Infinity : 0 }} className="absolute bottom-4 left-[42%] grid size-12 place-items-center rounded-full bg-coral-400 text-2xl">
        🎤
      </motion.span>
      <Hand x={48} y={78} pressing={phase === 0} />
    </>
  )
}

const DEMOS: Record<Play, (props: DemoProps) => React.ReactNode> = {
  sort: SortDemo,
  order: OrderDemo,
  match: MatchDemo,
  lab: LabDemo,
  mistake: MistakeDemo,
  case: CaseDemo,
  escape: EscapeDemo,
  boss: BossDemo,
  say: SayDemo,
}

export function Demo({ play, phase }: { play: Play; phase: Phase }) {
  const Shown = DEMOS[play]
  return (
    <div aria-hidden className="relative mx-auto h-40 w-full max-w-xs overflow-hidden rounded-2xl bg-sky-100 [perspective:600px] dark:bg-sky-700/30">
      <Shown phase={phase} />
    </div>
  )
}
