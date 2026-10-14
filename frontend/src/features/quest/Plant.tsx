/**
 * One skill as a plant (§28.3.4): a seedling, then a sprout, a leafy plant,
 * a bud and a flower as the skill moves up its review boxes. Due for review,
 * it droops and asks for water — never wilts away. It sways a little when
 * well, and holds still under reduced motion.
 */
import { motion } from 'motion/react'

const LEAF = 'hsl(var(--mint-400))'
const STEM = 'hsl(var(--mint-700))'
const POT = 'hsl(var(--coral-400))'
const SOIL = 'hsl(var(--grape-900))'
const BLOOM = 'hsl(var(--sun-400))'
const WATER = 'hsl(var(--sky-400))'

export function PlantArt({ box, thirsty, calm, size = 72 }: { box: number; thirsty: boolean; calm: boolean; size?: number }) {
  const height = [14, 22, 30, 36, 40, 42][Math.max(0, Math.min(5, box))]
  const leaves = Math.min(4, 1 + box)
  const top = 66 - height
  return (
    <svg viewBox="0 0 80 90" width={size} height={size * 1.125} aria-hidden>
      {thirsty && (
        <motion.path
          d="M62 10 C62 10 56 18 56 22 A6 6 0 0 0 68 22 C68 18 62 10 62 10 Z"
          fill={WATER}
          initial={false}
          animate={calm ? { opacity: 1 } : { y: [0, 3, 0], opacity: [0.7, 1, 0.7] }}
          transition={calm ? { duration: 0 } : { duration: 1.6, repeat: Infinity }}
        />
      )}
      <motion.g
        style={{ originX: '40px', originY: '66px' }}
        initial={false}
        animate={thirsty ? { rotate: 18, y: 2 } : calm ? { rotate: 0 } : { rotate: [-3, 3, -3] }}
        transition={thirsty || calm ? { type: 'spring', stiffness: 120, damping: 14 } : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path d={`M40 66 C40 ${66 - height / 2} 41 ${top + 6} 40 ${top}`} stroke={STEM} strokeWidth={3} fill="none" strokeLinecap="round" />
        {Array.from({ length: leaves }, (_, n) => {
          const y = 62 - (n + 1) * (height / (leaves + 1))
          const left = n % 2 === 0
          return (
            <path
              key={n}
              d={left ? `M40 ${y} C32 ${y - 8} 24 ${y - 2} 26 ${y + 4} C30 ${y + 6} 36 ${y + 3} 40 ${y}` : `M40 ${y} C48 ${y - 8} 56 ${y - 2} 54 ${y + 4} C50 ${y + 6} 44 ${y + 3} 40 ${y}`}
              fill={LEAF}
            />
          )
        })}
        {box >= 4 && (
          <g>
            {box >= 5 &&
              [0, 72, 144, 216, 288].map((angle) => (
                <ellipse key={angle} cx={40} cy={top - 6} rx={4} ry={7} fill={BLOOM} transform={`rotate(${angle} 40 ${top})`} />
              ))}
            <circle cx={40} cy={top} r={box >= 5 ? 4 : 5} fill={box >= 5 ? STEM : BLOOM} />
          </g>
        )}
      </motion.g>
      <ellipse cx={40} cy={67} rx={18} ry={3.5} fill={SOIL} opacity={0.85} />
      <path d="M22 66 H58 L54 86 H26 Z" fill={POT} />
      <rect x={20} y={63} width={40} height={6} rx={2} fill={POT} />
    </svg>
  )
}
