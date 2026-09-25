import { motion } from 'motion/react'
import { CheckCircle } from '@phosphor-icons/react'
import { useRef } from 'react'
import { rise, stagger } from '@/motion'
import { cn } from '@/lib/utils'
import { Buddy, type BuddyHandle } from './Buddy'
import { BUDDIES } from './profiles'
import { BUDDY_KEYS, type BuddyKey } from './types'
import { pick, VOICES } from './voices'

/** Five cards, each with a buddy moving about in it. Choosing one makes it
 *  wave and say hello. */
export function BuddyPicker({
  value,
  onChange,
  size = 112,
}: {
  value: BuddyKey | null
  onChange: (key: BuddyKey) => void
  size?: number
}) {
  return (
    <motion.ul
      role="radiogroup"
      aria-label="Choose your study buddy"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      variants={stagger(0.07)}
      initial="hidden"
      animate="shown"
    >
      {BUDDY_KEYS.map((key) => (
        <Choice key={key} buddy={key} chosen={value === key} onChoose={() => onChange(key)} size={size} />
      ))}
    </motion.ul>
  )
}

function Choice({ buddy, chosen, onChoose, size }: { buddy: BuddyKey; chosen: boolean; onChoose: () => void; size: number }) {
  const profile = BUDDIES[buddy]
  const figure = useRef<BuddyHandle>(null)
  const choose = () => {
    onChoose()
    figure.current?.play('wave')
    figure.current?.say(pick(VOICES[buddy].hello))
    figure.current?.burst('heart', 3, 'side')
  }
  return (
    <motion.li variants={rise} className="relative">
      <motion.button
        type="button"
        role="radio"
        aria-checked={chosen}
        onClick={choose}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.97 }}
        className={cn(
          'relative flex w-full flex-col items-center rounded-[1.75rem] border-2 px-3 pt-10 pb-4 text-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40',
          chosen ? 'border-transparent shadow-lg' : 'border-border bg-surface hover:border-hover-border',
        )}
        style={chosen ? { background: `hsl(var(--buddy-${buddy}) / 0.2)`, boxShadow: `0 0 0 3px hsl(var(--buddy-${buddy}))` } : undefined}
      >
        <Buddy ref={figure} buddy={buddy} size={size} interactive={false} mood={chosen ? 'happy' : 'idle'} bubble="top" />
        <span className="mt-1 font-display text-xl font-semibold">{profile.name}</span>
        <span className="text-sm font-bold capitalize text-muted-foreground">{profile.species}</span>
        <span className="mt-1 text-sm leading-snug text-muted-foreground">{profile.tagline}</span>
        {chosen && (
          <motion.span
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            className="absolute top-3 right-3 text-primary"
          >
            <CheckCircle weight="fill" className="size-7" />
          </motion.span>
        )}
      </motion.button>
    </motion.li>
  )
}
