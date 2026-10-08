/**
 * Match & Build (§23): every challenge is a piece of something big. Drag the
 * piece with the right answer into the glowing slot — or tap it, or press its
 * number — and the build grows; by the finale it is done and sets off. Best
 * for "which part goes where", steps and building up.
 */
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { Aside } from '../ui/ChallengeCard'
import { WORLDS } from '../worlds/info'
import { useGameKeys } from './keys'
import { OptionTile } from './OptionTile'
import { Structure, type Piece } from './structures'
import { COLUMNS, optionState, type StyleProps } from './types'

export function MatchBuild(props: StyleProps) {
  const { world, item, index, items, played, outcome, locked, calm, card, onChoose, onExpire, effect, boss } = props
  const target = useRef<HTMLDivElement>(null)
  const [hovering, setHovering] = useState(false)
  useEffect(() => {
    onExpire(null)
  }, [onExpire])
  useEffect(() => {
    if (outcome) effect('snap')
  }, [outcome, effect])
  useGameKeys(!locked, item.options.length, { pick: onChoose })

  const pieces: Piece[] = items.map((challenge) => {
    const result = played[challenge.id]
    return result ? (result.correct ? 'right' : 'missed') : null
  })
  const over = (point: { x: number; y: number }) => {
    const box = target.current?.getBoundingClientRect()
    return Boolean(box && point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom)
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 px-3 pb-3">
      {card}
      <div
        ref={target}
        // On a phone the pieces come straight after the question, the build below.
        className={cn('relative grid min-h-[140px] flex-1 place-items-center rounded-3xl max-sm:order-2 sm:min-h-[220px] border-4 border-dashed bg-surface/35 p-2 backdrop-blur-[2px] transition-colors', hovering ? 'border-star' : 'border-surface/70')}
        aria-label={`Building ${WORLDS[world].builds}: piece ${index + 1} of ${items.length}`}
      >
        <Structure world={world} pieces={pieces} current={index} calm={calm} />
      </div>
      <Aside className="max-sm:order-2">{boss ? 'The last piece!' : `Building ${WORLDS[world].builds} — drag the right piece into the glowing gap, or tap it.`}</Aside>
      <div className={cn('grid gap-3', item.options.length > 2 && 'sm:grid-cols-2', COLUMNS[item.options.length])} role="group" aria-label="Pieces">
        {item.options.map((text, n) => (
          <motion.div
            key={`${item.id}-${n}`}
            drag={!locked && !calm}
            dragSnapToOrigin
            dragElastic={0.6}
            whileDrag={{ scale: 1.05, zIndex: 30, rotate: -2 }}
            onDrag={(_, info) => setHovering(over(info.point))}
            onDragEnd={(_, info) => {
              setHovering(false)
              if (over(info.point)) onChoose(n)
            }}
            transition={spring.snappy}
            className="touch-none"
          >
            <OptionTile n={n} text={text} state={optionState(outcome, n)} disabled={locked} calm={calm} onChoose={() => onChoose(n)} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
