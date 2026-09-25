import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, BookOpenText, UserCirclePlus, UsersFour, UsersThree } from '@phosphor-icons/react'
import { rise } from '@/motion'
import { lookOf } from '@/lib/palette'
import { cn } from '@/lib/utils'
import type { ClassRoom } from './api'

/** A class at a glance: its colour, who is in it, and who is waiting. */
export function ClassCard({ room }: { room: ClassRoom }) {
  const look = lookOf(room.theme)
  return (
    <motion.li variants={rise} layout>
      <Link
        to={`/classes/${room.id}`}
        className="group block overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lg"
      >
        <div className={cn('relative h-28 overflow-hidden p-5', look.hero, look.onHero)}>
          <BookOpenText
            weight="duotone"
            aria-hidden
            className="absolute -bottom-4 -right-3 size-28 rotate-[-12deg] opacity-25 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110"
          />
          <p className="relative text-sm font-bold opacity-85">
            {[room.subject, room.grade_label].filter(Boolean).join(' · ') || 'Class'}
          </p>
          <p className="relative mt-1 break-words font-display text-2xl font-semibold">{room.name}</p>
          {room.pending > 0 && (
            <motion.span
              className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-coral-700 shadow"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            >
              <UserCirclePlus weight="fill" className="size-4" />
              {room.pending} waiting
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-4 px-5 py-4 text-sm font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <UsersThree weight="duotone" className="size-5 text-primary" />
            {room.students} {room.students === 1 ? 'student' : 'students'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UsersFour weight="duotone" className="size-5 text-primary" />
            {room.groups} {room.groups === 1 ? 'group' : 'groups'}
          </span>
          <ArrowRight weight="bold" className="ml-auto size-5 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </div>
      </Link>
    </motion.li>
  )
}
