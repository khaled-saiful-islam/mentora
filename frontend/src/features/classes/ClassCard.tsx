import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, BookOpenText, Plus, UserCirclePlus } from '@phosphor-icons/react'
import { rise } from '@/motion'
import { lookOf } from '@/lib/palette'
import { cn } from '@/lib/utils'
import type { ClassRoom } from './api'
import { Faces, NextLiveLine, Stat } from './ClassBits'

/**
 * A class at a glance: its colour, who is in it and who is waiting, what is
 * shared and how it went, and the next live lesson. The whole card opens the
 * class; the live lesson inside it opens that lesson.
 */
export function ClassCard({ room }: { room: ClassRoom }) {
  const look = lookOf(room.theme)
  const pulse = room.pulse
  return (
    <motion.li variants={rise} layout className="group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-sm transition-[transform,box-shadow] duration-200 focus-within:ring-4 focus-within:ring-ring/40 hover:-translate-y-1 hover:shadow-lg">
      {/* The whole card opens the class. What sits on top lets clicks
          through, except its own links. */}
      <Link to={`/classes/${room.id}`} aria-label={`Open ${room.name}`} className="absolute inset-0 z-0 focus-visible:outline-none" />
      <div className={cn('pointer-events-none relative overflow-hidden p-5', look.hero, look.onHero)}>
        <BookOpenText
          weight="duotone"
          aria-hidden
          className="absolute -bottom-4 -right-3 size-28 rotate-[-12deg] opacity-25 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110"
        />
        <p className="relative text-sm font-bold opacity-85">{[room.subject, room.grade_label].filter(Boolean).join(' · ') || 'Class'}</p>
        <h2 className="relative mt-1 break-words font-display text-2xl font-semibold">{room.name}</h2>
        {room.pending > 0 && (
          <Link to={`/classes/${room.id}/requests`} className="pointer-events-auto relative z-10 mt-3 inline-flex">
            <motion.span
              className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-coral-700 shadow"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            >
              <UserCirclePlus weight="fill" className="size-4" />
              {room.pending} waiting to join
            </motion.span>
          </Link>
        )}
      </div>

      <div className="pointer-events-none relative flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Faces names={pulse?.faces ?? []} total={room.students} />
          <p className="text-sm font-bold text-muted-foreground">
            {room.students} {room.students === 1 ? 'student' : 'students'} · {room.groups} {room.groups === 1 ? 'group' : 'groups'}
          </p>
        </div>
        {pulse && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat value={pulse.shared} label="shared" />
              <Stat value={pulse.average === null ? '—' : `${Math.round(pulse.average)}%`} label="first-try score" />
              <Stat value={pulse.finished_week} label="done this week" />
            </div>
            <div className="pointer-events-auto relative z-10">
              <NextLiveLine live={pulse.next_live} to={(id) => `/live/${id}`} empty="No live lesson planned" />
            </div>
          </>
        )}
        <p className="mt-auto flex items-center justify-end gap-1 text-sm font-bold text-muted-foreground transition-colors group-hover:text-primary">
          Open class
          <ArrowRight weight="bold" className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </p>
      </div>
    </motion.li>
  )
}

/** The last tile in the grid: room for one more class. */
export function NewClassTile({ onNew }: { onNew: () => void }) {
  return (
    <motion.li variants={rise} layout>
      <button
        type="button"
        onClick={onNew}
        className="group flex h-full min-h-56 w-full flex-col items-center justify-center gap-3 rounded-[1.75rem] border-2 border-dashed border-border p-6 text-center text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <motion.span
          className="grid size-14 place-items-center rounded-2xl bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
          whileHover={{ rotate: 90 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          <Plus weight="bold" className="size-7" />
        </motion.span>
        <span className="font-display text-lg font-semibold text-foreground">Start another class</span>
        <span className="text-sm">You'll get a link and a code to share.</span>
      </button>
    </motion.li>
  )
}
