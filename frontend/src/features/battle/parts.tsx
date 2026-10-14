/**
 * What the class screen and a student's device both show in a Class Battle
 * (§28.3.6): the rope or the boss, the clock, the teams, and the end.
 */
import { motion } from 'motion/react'
import { Heart, Sparkle, Timer, Trophy } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { BuddyAvatar } from '@/features/buddies'
import { Rope } from '@/features/game/revision/TugOfWar'
import { cn } from '@/lib/utils'
import { celebrate, spring, useCalmMotion } from '@/motion'
import type { BattleTeam, BattleView, TeamSpirit } from './api'

/** The rope for a Tug-of-War, the boss's health for Class vs Boss. */
export function Field({ view, big = false }: { view: BattleView; big?: boolean }) {
  const calm = useCalmMotion()
  if (view.mode === 'tug') return <Rope rope={view.rope} calm={calm} />
  const share = view.max_hp ? view.hp / view.max_hp : 1
  return (
    <section aria-label={`The boss: ${view.hp} of ${view.max_hp} health left`} className="flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-sm sm:p-4">
      <motion.span aria-hidden className={big ? 'text-6xl sm:text-7xl' : 'text-4xl'} animate={calm ? undefined : { rotate: [-4, 4, -4] }} transition={{ duration: 1.6, repeat: Infinity }}>
        👾
      </motion.span>
      <div className="min-w-0 flex-1">
        <p className={cn('font-display font-semibold', big ? 'text-2xl' : 'text-lg')}>The Muddle Monster</p>
        <div className="mt-1 h-4 overflow-hidden rounded-full bg-muted">
          <motion.div className="h-full rounded-full bg-wrong" initial={false} animate={{ width: `${Math.max(0, share) * 100}%` }} transition={spring.gentle} />
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 font-display text-xl font-bold tabular-nums">
        <Heart weight="fill" className="size-5 text-wrong" aria-hidden />
        {view.hp}
      </span>
    </section>
  )
}

export function Clock({ seconds, big = false }: { seconds: number; big?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 font-display font-bold tabular-nums shadow-sm', big ? 'text-2xl' : 'text-lg', seconds <= 5 && 'text-wrong')} aria-label={`${seconds} seconds left`}>
      <Timer weight="bold" className={big ? 'size-6' : 'size-5'} aria-hidden />
      {seconds}
    </span>
  )
}

/** Each team, its buddies lined up: who has joined. */
export function Teams({ teams, big = false }: { teams: BattleTeam[]; big?: boolean }) {
  return (
    <div className={cn('grid gap-3', teams.length > 1 && 'md:grid-cols-2')}>
      {teams.map((team) => (
        <section key={team.key} aria-label={team.name} className="rounded-3xl border-2 border-border bg-surface p-4">
          <p className={cn('flex items-center gap-2 font-display font-semibold', big ? 'text-2xl' : 'text-lg')}>
            <span aria-hidden>{team.icon}</span>
            <span className="min-w-0 break-words">{team.name}</span>
            <span className="ml-auto rounded-full bg-muted px-2.5 text-base tabular-nums">{team.members.length}</span>
          </p>
          <ul className="mt-3 flex flex-wrap gap-3">
            {team.members.map((member) => (
              <motion.li key={member.name} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.bouncy} className="flex w-16 flex-col items-center gap-1 text-center">
                <BuddyAvatar buddy={member.buddy} size={big ? 52 : 40} mood="happy" />
                <span className="w-full break-words text-xs font-bold leading-tight">{member.name}</span>
              </motion.li>
            ))}
            {team.members.length === 0 && <li className="text-muted-foreground">Waiting for players…</li>}
          </ul>
        </section>
      ))}
    </div>
  )
}

const OUTCOME: Record<NonNullable<BattleView['outcome']>, string> = {
  harimau: '🐯 Team Harimau pulls it home!',
  kancil: '🦌 Team Kancil pulls it home!',
  draw: "It's a draw: both teams pulled hard!",
  beaten: 'The boss is beaten! Together!',
  escaped: 'The boss got away… so close!',
}

/** The end: the result, then every team's spirit. Nobody is ranked. */
export function Finale({ view }: { view: BattleView }) {
  const calm = useCalmMotion()
  useEffect(() => {
    celebrate({ calm, power: 1.4 })
  }, [calm])
  const spirit = view.spirit
  return (
    <motion.section aria-label="The end of the battle" initial={calm ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.bouncy} className="mx-auto w-full max-w-3xl space-y-4 text-center">
      <Trophy weight="fill" className="mx-auto size-14 text-warning" aria-hidden />
      <h2 className="font-display text-3xl font-semibold md:text-4xl">{view.outcome ? OUTCOME[view.outcome] : 'The battle is over'}</h2>
      {spirit && (
        <>
          <div className={cn('grid gap-3', view.teams.length > 1 && 'md:grid-cols-2')}>
            {view.teams.map((team) => (
              <Spirit key={team.key} team={team} spirit={spirit.teams[team.key]} />
            ))}
          </div>
          {spirit.comeback_crew.length > 0 && (
            <p className="rounded-3xl bg-sun-100 p-4 text-lg dark:bg-sun-600/20">
              <Sparkle weight="fill" className="mr-1 inline size-5 text-sun-600" aria-hidden />
              <b>Comeback crew:</b> {spirit.comeback_crew.join(', ')}. Missed one, then got the next right!
            </p>
          )}
        </>
      )}
    </motion.section>
  )
}

function Spirit({ team, spirit }: { team: BattleTeam; spirit: TeamSpirit | undefined }) {
  const improved = spirit?.improved
  return (
    <div className="rounded-3xl border-2 border-border bg-surface p-4 text-left">
      <p className="font-display text-xl font-semibold">
        {team.icon} {team.name}
      </p>
      <ul className="mt-2 space-y-1 text-lg">
        <li>
          <b className="tabular-nums">{spirit?.right ?? 0}</b> right answers
        </li>
        <li>
          <b className="tabular-nums">{spirit?.comebacks ?? 0}</b> {spirit?.comebacks === 1 ? 'comeback' : 'comebacks'}
        </li>
        {improved != null && improved > 0 && <li>Got better as it went: up {Math.round(improved * 100)}%</li>}
      </ul>
    </div>
  )
}
