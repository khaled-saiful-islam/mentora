import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, MapTrifold, QrCode, Sparkle, UserCirclePlus } from '@phosphor-icons/react'
import { lookOfKind } from '@/features/learning/kinds'
import { useLearnStudio } from '@/features/learning/LearnStudio'
import { lookOf } from '@/lib/palette'
import { dueLabel } from '@/lib/time'
import { cn } from '@/lib/utils'
import { rise } from '@/motion'
import type { ClassRoom, RecentShare } from './api'
import { Faces, NextLiveLine, ScoreRing } from './ClassBits'

/**
 * A class the way a teacher checks on it: who it is, how it is scoring, how
 * the latest things shared are going, what is next live — and the two places
 * they go most, one tap away. The whole card opens the class; the links on
 * it open what they name.
 */
export function ClassCard({ room, wide = false }: { room: ClassRoom; wide?: boolean }) {
  const look = lookOf(room.theme)
  const pulse = room.pulse
  return (
    <motion.li
      variants={rise}
      layout
      className={cn(
        // A container: given a whole row, the card lays itself out in two
        // columns — the class on the left, how it is going on the right.
        '@container group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-sm transition-[translate,transform,box-shadow] duration-200 focus-within:ring-4 focus-within:ring-ring/40 hover:-translate-y-1 hover:shadow-lg',
        wide && 'lg:col-span-2',
      )}
    >
      <Link to={`/classes/${room.id}`} aria-label={`Open ${room.name}`} className="absolute inset-0 z-0 focus-visible:outline-none" />
      {/* The class's colour runs down the edge, like a folder tab. */}
      <span aria-hidden className={cn('pointer-events-none absolute inset-y-0 left-0 w-1.5', look.hero)} />

      <div className="flex flex-1 flex-col @3xl:grid @3xl:grid-cols-2 @3xl:items-start">
        <div>
          <div className="pointer-events-none relative flex items-start gap-4 p-5 pl-6">
            <span
              aria-hidden
              className={cn(
                'grid size-14 shrink-0 place-items-center rounded-2xl font-display text-xl font-semibold shadow-press transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105',
                look.hero,
                look.onHero,
              )}
            >
              {initials(room.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                {[room.subject, room.grade_label].filter(Boolean).join(' · ') || 'Class'}
              </p>
              <h2 className="break-words font-display text-2xl font-semibold leading-tight">{room.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <Faces names={pulse?.faces ?? []} total={room.students} />
                <span className="text-sm font-bold text-muted-foreground">
                  {room.students} {room.students === 1 ? 'student' : 'students'} · {room.groups} {room.groups === 1 ? 'group' : 'groups'}
                </span>
              </div>
            </div>
            {pulse && <ScoreRing value={pulse.average} label="class score" />}
          </div>

          {room.pending > 0 && (
            <Link
              to={`/classes/${room.id}/requests`}
              className="relative z-10 mx-5 mb-3 flex items-center gap-2 rounded-2xl bg-coral-100 px-3 py-2 text-sm font-bold text-coral-700 transition-colors hover:brightness-95 dark:bg-coral-700/30 dark:text-coral-100"
            >
              <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
                <UserCirclePlus weight="fill" className="size-5" aria-hidden />
              </motion.span>
              {room.pending} waiting to join — let them in
              <ArrowRight weight="bold" className="ml-auto size-4" aria-hidden />
            </Link>
          )}
        </div>

        {pulse && (
          <div className="pointer-events-none relative flex-1 space-y-3 px-5 pb-4 @3xl:pt-5 @3xl:pl-0">
            <Latest recent={pulse.recent} />
            <div className="pointer-events-auto relative z-10">
              <NextLiveLine live={pulse.next_live} to={(id) => `/live/${id}`} empty="No live lesson planned" />
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 mt-auto flex flex-wrap items-center gap-1 border-t border-border px-3 py-2">
        <FooterLink to={`/classes/${room.id}/invite`} Icon={QrCode} label="Invite" />
        <FooterLink to={`/classes/${room.id}/coverage`} Icon={MapTrifold} label="Coverage" />
        {pulse && (
          <span className="ml-auto px-2 text-sm font-bold text-muted-foreground">
            {pulse.finished_week} done this week
          </span>
        )}
      </div>
    </motion.li>
  )
}

/** How the latest shares are going: finished of everyone it is for. */
function Latest({ recent }: { recent: RecentShare[] }) {
  const studio = useLearnStudio()
  if (recent.length === 0) {
    return (
      <div className="pointer-events-auto relative z-10 flex flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
        Nothing shared yet.
        <button type="button" onClick={() => studio.create('quiz')} className="inline-flex items-center gap-1 font-bold text-primary hover:underline">
          <Sparkle weight="fill" className="size-4" aria-hidden /> Make a quiz
        </button>
      </div>
    )
  }
  return (
    <ul className="space-y-2">
      {recent.map((share, i) => {
        const look = lookOfKind(share.kind)
        const done = share.audience ? share.completed / share.audience : 0
        const due = share.due_at && !share.closed ? dueLabel(share.due_at) : null
        return (
          <li key={share.id} className="pointer-events-auto relative z-10">
            <Link to={`/assignments/${share.id}`} className="flex items-center gap-3 rounded-2xl bg-muted/50 px-3 py-2 transition-colors hover:bg-hover">
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl', look.soft)}>
                <look.Icon weight="duotone" className="size-5" aria-hidden />
              </span>
              <span className="min-w-[min(100%,8rem)] flex-1">
                <span className="block break-words text-sm font-bold leading-snug">{share.title}</span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-border">
                    <motion.span
                      className="block h-full rounded-full"
                      style={{ background: look.colour }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(done * 100, share.completed ? 6 : 0)}%` }}
                      transition={{ type: 'spring', stiffness: 80, damping: 18, delay: 0.1 + i * 0.08 }}
                    />
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                    {share.completed}/{share.audience}
                  </span>
                </span>
              </span>
              {share.closed ? (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">Closed</span>
              ) : (
                due && (
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-bold', due.late ? 'bg-coral-100 text-coral-700' : 'bg-sun-100 text-sun-600')}>
                    {due.late ? 'Past due' : due.text.replace('Due ', '')}
                  </span>
                )
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function FooterLink({ to, Icon, label }: { to: string; Icon: typeof QrCode; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-hover hover:text-foreground">
      <Icon weight="bold" className="size-4" aria-hidden />
      {label}
    </Link>
  )
}

/** "4 Cerdik (demo)" → "4C"; "Sains Tahun 5" → "ST". */
function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w))
  return (words.slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase()
}
