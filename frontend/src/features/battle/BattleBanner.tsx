/**
 * On a student's home: a Class Battle on now in one of their classes
 * (§28.3.6), with the way in. Checked every few seconds while the home is
 * open, so a battle opened in class appears without a reload.
 */
import { motion } from 'motion/react'
import { Sword } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { ButtonLink } from '@/components/ui'
import { spring, useCalmMotion } from '@/motion'
import { battleApi, type BattleMode } from './api'

const EVERY_MS = 8000

export function BattleBanner({ className }: { className?: string }) {
  const [battles, setBattles] = useState<{ id: string; title: string; mode: BattleMode }[]>([])
  const calm = useCalmMotion()

  useEffect(() => {
    let live = true
    const look = () =>
      battleApi.mine().then(
        (found) => live && setBattles(found.items),
        () => undefined,
      )
    void look()
    const timer = window.setInterval(() => void look(), EVERY_MS)
    return () => {
      live = false
      window.clearInterval(timer)
    }
  }, [])

  const battle = battles[0]
  if (!battle) return null
  return (
    <motion.section
      aria-label="A Class Battle is on"
      initial={calm ? false : { y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring.bouncy}
      className={`flex flex-wrap items-center gap-4 rounded-[2rem] bg-gradient-to-r from-coral-400 to-kind-games-vivid p-5 text-white shadow-lg ${className ?? ''}`}
    >
      <motion.span aria-hidden animate={calm ? undefined : { rotate: [-10, 10, -10] }} transition={{ duration: 1.2, repeat: Infinity }} className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/20">
        <Sword weight="fill" className="size-8" />
      </motion.span>
      <div className="min-w-[min(100%,14rem)] flex-1">
        <p className="text-sm font-bold uppercase tracking-wider opacity-90">{battle.mode === 'boss' ? 'Class vs Boss' : 'Tug-of-War'} · on now</p>
        <p className="break-words font-display text-2xl font-semibold">{battle.title}</p>
      </div>
      <ButtonLink to={`/battle/${battle.id}/play`} variant="sun" size="lg">
        Join the battle
      </ButtonLink>
    </motion.section>
  )
}
