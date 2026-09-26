/**
 * A student's notes from a live lesson: the key points of each part, and the
 * whole lesson as it was said — to read back before the quiz.
 */
import { BookOpenText, CheckCircle } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Card, Skeleton } from '@/components/ui'
import { useResource } from '@/hooks/useResource'
import { rise, stagger } from '@/motion'
import { roomApi } from './api'

export function Notes({ id }: { id: string }) {
  const notes = useResource(`live-notes:${id}`, () => roomApi.notes(id))
  if (!notes.data) return notes.error ? null : <Skeleton className="h-48 rounded-3xl" />
  const { parts, transcript } = notes.data
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
        <BookOpenText weight="duotone" className="size-7 text-kind-live" aria-hidden />
        My notes
      </h2>
      <motion.ol variants={stagger()} initial="hidden" animate="shown" className="grid gap-3 sm:grid-cols-2">
        {parts.map((part, i) => (
          <motion.li key={i} variants={rise}>
            <Card className="h-full p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-kind-live">{part.subtopic}</p>
              <h3 className="break-words font-display text-lg font-semibold">{part.title}</h3>
              {part.key_points.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {part.key_points.map((point, n) => (
                    <li key={n} className="flex items-start gap-1.5 break-words text-sm">
                      <CheckCircle weight="fill" className="mt-0.5 size-4 shrink-0 text-mint-700" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </motion.li>
        ))}
      </motion.ol>
      <details className="rounded-3xl border-2 border-border bg-surface p-4">
        <summary className="cursor-pointer font-display text-lg font-semibold">The whole lesson, as it was said</summary>
        <ol className="mt-3 space-y-1.5">
          {transcript.map((line, i) => (
            <li key={i} className={line.speaker === 'student' ? 'break-words rounded-xl bg-sun-100 px-3 py-1.5 text-sm text-grape-900' : 'break-words px-1 text-sm leading-relaxed'}>
              {line.speaker === 'student' && <span className="font-bold">{line.name ?? 'A student'} asked: </span>}
              {line.text}
            </li>
          ))}
        </ol>
      </details>
    </section>
  )
}
