/**
 * On the finish screen of today's quest (§28.3.4): "Quest complete!", the
 * streak it kept alive, and the garden it watered.
 */
import { motion } from 'motion/react'
import { Fire, Plant as Sprout } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { spring } from '@/motion'
import { dayApi, type MyDay } from './api'

// The title every quest set carries (`services/quest_service.QUEST_TITLE`).
export const QUEST_TITLE = "Today's Quest"

export function QuestDone({ title }: { title: string }) {
  const [day, setDay] = useState<MyDay | null>(null)
  const quest = title === QUEST_TITLE
  useEffect(() => {
    if (!quest) return
    let live = true
    void dayApi.get().then((found) => live && setDay(found)).catch(() => undefined)
    return () => {
      live = false
    }
  }, [quest])
  if (!quest || !day) return null
  const days = day.streak.days
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...spring.bouncy, delay: 1.6 }}
      className="mt-5 inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-3xl bg-sun-100 px-5 py-3 font-display text-lg font-semibold text-grape-900 dark:bg-sun-600/25 dark:text-sun-100"
      role="status"
    >
      <span className="inline-flex items-center gap-1.5">
        <Fire weight="fill" className="size-6 text-sun-600 dark:text-sun-300" aria-hidden />
        Quest complete! {days}-day streak
      </span>
      <span className="inline-flex items-center gap-1.5 text-base">
        <Sprout weight="fill" className="size-5 text-mint-700 dark:text-mint-400" aria-hidden />
        Your plants are watered
      </span>
    </motion.div>
  )
}
