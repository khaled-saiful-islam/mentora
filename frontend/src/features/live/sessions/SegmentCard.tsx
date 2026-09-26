/**
 * One part of the lesson, for the teacher to check: what Astra will say, what
 * the screen shows, the quick check at the end — and a way to hear it, change
 * it by hand, or ask for it to be written differently.
 */
import { ArrowsClockwise, Check, PencilSimple, Play, Question, Sparkle, Stop, Trash } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import { PictureFrame } from '@/features/guide/PictureFrame'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import type { Beat } from '../api'
import type { Segment } from './api'

const WORDS_PER_SECOND = 2.6

export function SegmentCard({
  segment,
  editable,
  playing,
  saying,
  onListen,
  onStop,
  onSave,
  onRewrite,
  onRemoveImage,
}: {
  segment: Segment
  editable: boolean
  playing: boolean
  saying: string | null
  onListen: () => void
  onStop: () => void
  onSave: (patch: { title: string; beats: { say: string; show: string | null; pause: Beat['pause'] }[] }) => Promise<void>
  onRewrite: (instruction: string) => Promise<void>
  onRemoveImage?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const words = segment.beats.reduce((n, b) => n + b.say.split(/\s+/).length, 0)
  const seconds = Math.round(words / WORDS_PER_SECOND)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
      className={cn(
        'rounded-[1.75rem] border-2 bg-surface p-4 shadow-sm transition-colors sm:p-5',
        playing ? 'border-kind-live-vivid shadow-[0_0_0_4px_hsl(var(--kind-live-vivid)/0.15)]' : 'border-border',
      )}
    >
      <header className="flex flex-wrap items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-kind-live-vivid font-display text-lg font-bold text-white">
          {segment.position + 1}
        </span>
        <div className="min-w-[min(100%,14rem)] flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-kind-live">{segment.subtopic}</p>
          <h3 className="break-words font-display text-xl font-semibold leading-snug">{segment.title}</h3>
          <p className="text-sm text-muted-foreground">
            {segment.beats.length} beats · about {seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 6) / 10} min`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {playing ? (
            <Button size="sm" variant="secondary" onClick={onStop}>
              <Stop weight="fill" className="size-4" aria-hidden />
              Stop
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onListen}>
              <Play weight="fill" className="size-4" aria-hidden />
              Listen
            </Button>
          )}
          {editable && !editing && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <PencilSimple weight="bold" className="size-4" aria-hidden />
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAsking((a) => !a)}>
                <ArrowsClockwise weight="bold" className="size-4" aria-hidden />
                Rewrite
              </Button>
            </>
          )}
        </div>
      </header>

      {segment.image && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center">
          <div className="overflow-hidden rounded-2xl border-2 border-border">
            <PictureFrame picture={segment.image} alt={segment.title} className="aspect-[16/9]" drift={false} />
          </div>
          <div className="min-w-0 text-sm text-muted-foreground">
            <p className="break-words">On screen while this part is taught{segment.image.source ? ` · from ${segment.image.source}` : ''}.</p>
            {editable && onRemoveImage && (
              <Button size="sm" variant="ghost" className="mt-1 -ml-3" onClick={onRemoveImage}>
                <Trash weight="bold" className="size-4" aria-hidden />
                Remove the picture
              </Button>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {asking && (
          <Rewrite
            busy={busy}
            onCancel={() => setAsking(false)}
            onGo={async (instruction) => {
              setBusy(true)
              try {
                await onRewrite(instruction)
                setAsking(false)
              } finally {
                setBusy(false)
              }
            }}
          />
        )}
      </AnimatePresence>

      {editing ? (
        <Editor
          segment={segment}
          busy={busy}
          onCancel={() => setEditing(false)}
          onSave={async (patch) => {
            setBusy(true)
            try {
              await onSave(patch)
              setEditing(false)
            } finally {
              setBusy(false)
            }
          }}
        />
      ) : (
        <ol className="mt-4 space-y-2">
          {segment.beats.map((beat) => (
            <li key={beat.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <p className="break-words rounded-2xl bg-muted/60 px-3 py-2 leading-relaxed">
                {beat.sentences.map((sentence, i) => (
                  <span key={i} className={cn('rounded transition-colors', saying === sentence && 'bg-kind-live-vivid/20 text-kind-live')}>
                    {sentence}{' '}
                  </span>
                ))}
                <span className="ml-1 whitespace-nowrap text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  · {beat.pause === 'think' ? 'thinking time' : beat.pause}
                </span>
              </p>
              {beat.show ? (
                <p className="flex items-start gap-1.5 self-start break-words rounded-2xl border-2 border-dashed border-kind-live-vivid/40 px-3 py-2 text-sm font-semibold text-kind-live">
                  <Sparkle weight="fill" className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {beat.show}
                </p>
              ) : (
                <span aria-hidden className="hidden sm:block" />
              )}
            </li>
          ))}
        </ol>
      )}

      {segment.checkin && (
        <div className="mt-4 rounded-2xl bg-sun-100 p-3 text-grape-900 dark:bg-sun-600/20 dark:text-sun-100">
          <p className="flex items-start gap-1.5 break-words font-bold">
            <Question weight="fill" className="mt-0.5 size-4 shrink-0" aria-hidden />
            Quick check: {segment.checkin.question}
          </p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {segment.checkin.options.map((option, i) => (
              <li
                key={i}
                className={cn(
                  'flex items-start gap-1.5 break-words rounded-xl px-2.5 py-1.5 text-sm font-semibold',
                  i === segment.checkin?.answer ? 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100' : 'bg-white/60 dark:bg-white/10',
                )}
              >
                {i === segment.checkin?.answer && <Check weight="bold" className="mt-0.5 size-4 shrink-0" aria-label="Right answer" />}
                {option}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.article>
  )
}

function Rewrite({ busy, onCancel, onGo }: { busy: boolean; onCancel: () => void; onGo: (instruction: string) => Promise<void> }) {
  const [instruction, setInstruction] = useState('')
  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={(e) => {
        e.preventDefault()
        void onGo(instruction)
      }}
      className="mt-3 overflow-hidden"
    >
      <div className="flex flex-wrap gap-2 rounded-2xl bg-kind-live-vivid/10 p-3">
        <Input
          aria-label="How should it change?"
          value={instruction}
          maxLength={300}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. simpler words, or use the durian as the example"
          className="min-w-[min(100%,14rem)] flex-1"
        />
        <Button type="submit" size="sm" disabled={busy}>
          <Sparkle weight="fill" className="size-4" aria-hidden />
          {busy ? 'Rewriting…' : 'Rewrite it'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </motion.form>
  )
}

function Editor({
  segment,
  busy,
  onCancel,
  onSave,
}: {
  segment: Segment
  busy: boolean
  onCancel: () => void
  onSave: (patch: { title: string; beats: { say: string; show: string | null; pause: Beat['pause'] }[] }) => Promise<void>
}) {
  const [title, setTitle] = useState(segment.title)
  const [beats, setBeats] = useState(segment.beats.map((b) => ({ say: b.say, show: b.show ?? '', pause: b.pause })))
  const set = (i: number, patch: Partial<(typeof beats)[number]>) => setBeats((all) => all.map((b, n) => (n === i ? { ...b, ...patch } : b)))
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void onSave({ title, beats: beats.filter((b) => b.say.trim()).map((b) => ({ ...b, show: b.show.trim() || null })) })
      }}
    >
      <Input aria-label="Title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
      {beats.map((beat, i) => (
        <div key={i} className="grid gap-2 rounded-2xl bg-muted/50 p-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <textarea
            aria-label={`What Astra says, beat ${i + 1}`}
            rows={3}
            maxLength={600}
            value={beat.say}
            onChange={(e) => set(i, { say: e.target.value })}
            className="w-full rounded-xl border-2 border-border bg-surface px-3 py-2"
          />
          <div className="space-y-2">
            <Input aria-label={`On screen, beat ${i + 1}`} placeholder="On screen (optional)" value={beat.show} maxLength={240} onChange={(e) => set(i, { show: e.target.value })} />
            <select
              aria-label={`Pause after beat ${i + 1}`}
              value={beat.pause}
              onChange={(e) => set(i, { pause: e.target.value as Beat['pause'] })}
              className="w-full rounded-xl border-2 border-border bg-surface px-2 py-1.5 text-sm font-semibold"
            >
              <option value="short">Short pause</option>
              <option value="breath">A breath</option>
              <option value="think">Thinking time</option>
            </select>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          <Check weight="bold" className="size-4" aria-hidden />
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
