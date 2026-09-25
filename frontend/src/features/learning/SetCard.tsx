import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowClockwise, Broadcast, CircleNotch, Globe, PencilSimple, Play, SmileySad, WarningCircle } from '@phosphor-icons/react'
import { buttonClass, Chip } from '@/components/ui'
import { rise } from '@/motion'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { SetSummary } from './api'
import { lookOfKind, nounOf } from './kinds'

/** A set at a glance: kind, title, how many, where it has been shared. */
export function SetCard({ set, onWatch, onRetry }: { set: SetSummary; onWatch: () => void; onRetry: () => void }) {
  const look = lookOfKind(set.kind)
  const making = set.status === 'generating'
  const broken = set.status === 'failed' || set.status === 'refused'
  const body = (
    <>
      <div className={cn('relative h-24 overflow-hidden p-4', look.hero)}>
        <look.Icon weight="duotone" aria-hidden className="absolute -bottom-5 -right-3 size-24 rotate-[-10deg] opacity-25 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110" />
        <p className="relative text-sm font-bold opacity-85">{[look.label, set.subject, set.grade_label].filter(Boolean).join(' · ')}</p>
        <p className="relative mt-0.5 break-words font-display text-xl font-semibold leading-tight">{set.title}</p>
        {making && <span className="skeleton absolute inset-0 opacity-25" aria-hidden />}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
        {making ? (
          <Chip tone="grape"><CircleNotch weight="bold" className="size-3.5 animate-spin" /> Being made…</Chip>
        ) : broken ? (
          <Chip tone="coral"><SmileySad weight="bold" className="size-3.5" /> {set.status === 'refused' ? 'Not a school topic' : "Couldn't be made"}</Chip>
        ) : (
          <span className="font-bold text-muted-foreground">{nounOf(set.kind, set.item_count)}</span>
        )}
        {set.shares > 0 && <Chip tone="mint"><Broadcast weight="bold" className="size-3.5" /> Shared {set.shares}×</Chip>}
        {set.purpose === 'practice' && <Chip tone="sun">Practice</Chip>}
        {!making && !broken && (set.grounded ? <Globe weight="duotone" className="size-4 text-sky-700 dark:text-sky-100" aria-label="Grounded in sources" /> : <WarningCircle weight="duotone" className="size-4 text-warning" aria-label="Not grounded in sources" />)}
        <span className="ml-auto text-xs text-muted-foreground">{timeAgo(set.updated_at)}</span>
      </div>
    </>
  )
  const frame = 'group block overflow-hidden rounded-[1.5rem] border border-border bg-surface text-left shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lg'
  return (
    <motion.li variants={rise} layout>
      {making ? (
        <button type="button" onClick={onWatch} className={cn(frame, 'w-full')}>{body}</button>
      ) : broken ? (
        <div className={frame}>
          {body}
          <div className="border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">{set.failure}</p>
            <button type="button" onClick={onRetry} className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
              <ArrowClockwise weight="bold" className="size-4" /> Try again
            </button>
          </div>
        </div>
      ) : set.purpose === 'practice' ? (
        <div className={frame}>
          <Link to={`/library/${set.id}`} className="block">{body}</Link>
          <div className="flex gap-2 border-t border-border px-4 py-3">
            <Link to={`/practice/${set.id}`} className={buttonClass('sun', 'sm', 'flex-1')}>
              <Play weight="fill" className="size-4" /> Practise
            </Link>
            <Link to={`/library/${set.id}`} className={buttonClass('ghost', 'sm')}>
              <PencilSimple weight="bold" className="size-4" /> Edit
            </Link>
          </div>
        </div>
      ) : (
        <Link to={`/library/${set.id}`} className={frame}>{body}</Link>
      )}
    </motion.li>
  )
}
