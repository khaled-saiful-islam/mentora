/**
 * What finishing something did for the buddy (§28.3.1): "Momo grew +7!", and
 * the bar filling from where it was. Asks for the new growth itself, once,
 * when the finish screen opens; says nothing when nothing grew, and nothing
 * to a teacher previewing. A stage reached is celebrated after the finish
 * screen, never on top of it.
 */
import { motion } from 'motion/react'
import { Plant } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { spring } from '@/motion'
import { stageFor } from './growth'
import { GrowthBar } from './GrowthBar'
import { useGrowth, type Growth } from './GrowthProvider'
import { BUDDIES } from './profiles'
import { isBuddyKey } from './types'

// Shown after the stars and points have had their moment.
const SHOW_AFTER_S = 2.6
const FILL_AFTER_MS = 3200

export function GrowthGain({ buddy }: { buddy: string | null | undefined }) {
  const growth = useGrowth()
  const [before] = useState(() => growth?.growth?.points ?? null)
  const [after, setAfter] = useState<Growth | null>(null)
  const [filled, setFilled] = useState(false)

  useEffect(() => {
    let live = true
    void growth?.refresh().then((found) => live && setAfter(found))
    const fill = window.setTimeout(() => setFilled(true), FILL_AFTER_MS)
    return () => {
      live = false
      window.clearTimeout(fill)
    }
    // Once, as the finish screen opens.
  }, [])

  if (!isBuddyKey(buddy) || before === null || !after || after.points <= before) return null
  const { name } = BUDDIES[buddy]
  const grewUp = stageFor(after.points) > stageFor(before)
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring.bouncy, delay: SHOW_AFTER_S }}
      className="mt-5 w-full max-w-sm rounded-3xl bg-surface/80 px-4 py-3 text-left shadow-sm"
    >
      <p className="flex items-center gap-2 font-display text-lg font-semibold">
        <Plant weight="fill" className="size-5 shrink-0" style={{ color: `hsl(var(--buddy-${buddy}))` }} aria-hidden />
        <span className="break-words">
          {name} grew +{after.points - before}!
        </span>
      </p>
      <GrowthBar buddy={buddy} points={filled ? after.points : before} within={stageFor(before)} className="mt-2" />
      {grewUp && <p className="mt-1 text-sm font-bold">Something big is happening to {name}…</p>}
    </motion.div>
  )
}
