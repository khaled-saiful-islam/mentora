/**
 * One live lesson, from the teacher's side: add materials, have the lesson
 * written, check and hear every part, approve it (which records the voice),
 * and put it on the group's schedule.
 */
import {
  ArrowLeft,
  CalendarPlus,
  FileText,
  Microphone,
  PencilSimple,
  Play,
  Sparkle,
  Trash,
  UploadSimple,
  X,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, ButtonLink, Card, Input, Skeleton } from '@/components/ui'
import { useResource } from '@/hooks/useResource'
import { cn } from '@/lib/utils'
import { Page, rise, spring } from '@/motion'
import { followWork, sessionsApi, STATUS_WORDS, type SessionDetail, type Segment, type WorkEvent } from './api'
import { SegmentCard } from './SegmentCard'
import { Summary } from './Summary'
import { AstraBadge } from './SessionCard'
import { useSegmentPlayer } from './useSegmentPlayer'
import { toLocalInput, whenLabel } from './when'

const EDITABLE = ['draft', 'planned', 'failed', 'approved']

export default function SessionPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const detail = useResource(`live-session:${id}`, () => sessionsApi.get(id))
  const [stage, setStage] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const live = detail.data
  const player = useSegmentPlayer(live ? { voice: live.voice.voice, speed: live.voice.speed, model: 'ilmu-tts-v2.1' } : null)

  useWork(live, (event) => {
    if (event.type === 'stage') setStage(event.label)
    if (event.type === 'part')
      detail.setData((d) => ({ ...(d as SessionDetail), segments: [...(d as SessionDetail).segments, ...event.segments], status: 'planning' }))
    if (event.type === 'recording') setProgress({ done: event.done, total: event.total })
    if (event.type === 'failed') setError(event.message)
    if (event.type === 'done' || event.type === 'failed' || event.type === 'settled') {
      setStage(null)
      setProgress(null)
      void detail.reload()
    }
  })

  const act = async (run: () => Promise<unknown>) => {
    setError(null)
    try {
      await run()
      await detail.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Please try again.')
    }
  }

  if (!live) {
    return (
      <Page className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
        {detail.error ? <Alert>{detail.error}</Alert> : <Skeleton className="h-64 rounded-[2rem]" />}
      </Page>
    )
  }

  const editable = EDITABLE.includes(live.status)
  const setSegment = (fresh: Segment) =>
    detail.setData((d) => ({ ...(d as SessionDetail), segments: (d as SessionDetail).segments.map((s) => (s.id === fresh.id ? fresh : s)) }))

  return (
    <Page className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <motion.header variants={rise} className="mb-6">
        <Link to="/live" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft weight="bold" className="size-4" aria-hidden />
          Live lessons
        </Link>
        <div className="flex flex-wrap items-center gap-4 rounded-[2rem] bg-gradient-to-br from-grape-900 via-grape-800 to-[hsl(var(--kind-live))] p-5 text-white shadow-lg">
          <AstraBadge size={96} mood={live.status === 'scheduled' ? 'happy' : 'idle'} />
          <div className="min-w-[min(100%,16rem)] flex-1">
            <span className="inline-flex rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold">{STATUS_WORDS[live.status]}</span>
            <h1 className="mt-1 break-words font-display text-3xl font-semibold leading-tight sm:text-4xl">{live.title}</h1>
            <p className="mt-1 break-words text-white/80">
              {live.class_name} · {live.group_name} · {live.students} student{live.students === 1 ? '' : 's'} · {live.duration_minutes} minutes
            </p>
            {live.scheduled_at && <p className="font-semibold text-sun-300">{whenLabel(live.scheduled_at)}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {editable && (
              <Button variant="secondary" size="sm" onClick={() => navigate(`/live/${live.id}/setup`)}>
                <PencilSimple weight="bold" className="size-4" aria-hidden />
                Change setup
              </Button>
            )}
            {!['planning', 'recording', 'scheduled', 'lobby', 'live'].includes(live.status) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => {
                  if (window.confirm('Delete this live lesson?')) void sessionsApi.remove(live.id).then(() => navigate('/live'))
                }}
              >
                <Trash weight="bold" className="size-4" aria-hidden />
                Delete
              </Button>
            )}
          </div>
        </div>
      </motion.header>

      {error && <Alert className="mb-4">{error}</Alert>}
      {live.status === 'failed' && live.failure && <Alert className="mb-4">{live.failure}</Alert>}
      {live.flagged && (
        <Alert tone="warning" className="mb-4">
          A student reported something in this lesson. It is in the safety queue for the admins to look at.
        </Alert>
      )}
      {live.status === 'planned' && live.failure && <Alert tone="warning" className="mb-4">{live.failure}</Alert>}

      <div className="space-y-6">
        {(live.status === 'draft' || live.status === 'failed') && (
          <Prepare live={live} onChange={() => void detail.reload()} onWrite={() => act(() => sessionsApi.plan(live.id))} setError={setError} />
        )}
        {live.status === 'planning' && <Writing stage={stage} parts={live.settings.breakdown} written={live.segments.length} />}
        {live.status === 'planned' && (
          <ActionBar
            title="Check every part, then approve it"
            body="Listen to any part. Edit it or ask for a rewrite. Approving records Astra's voice for the whole lesson."
          >
            <Button onClick={() => void act(() => sessionsApi.approve(live.id))}>
              <Microphone weight="fill" className="size-4" aria-hidden />
              Approve & record the voice
            </Button>
            <Button variant="ghost" onClick={() => void act(() => sessionsApi.plan(live.id))}>
              <Sparkle weight="fill" className="size-4" aria-hidden />
              Write it all again
            </Button>
          </ActionBar>
        )}
        {live.status === 'recording' && <Recording progress={progress} />}
        {['live', 'lobby'].includes(live.status) && (
          <ActionBar title={live.status === 'live' ? 'The lesson is live' : 'The room is open'} body="Watch it, see the hands, pause, skip or end.">
            <ButtonLink to={`/live/${live.id}/room`} variant="sun">
              <Play weight="fill" className="size-4" aria-hidden />
              Go to the room
            </ButtonLink>
          </ActionBar>
        )}
        {live.status === 'ended' && <Summary id={live.id} />}
        {(live.status === 'approved' || live.status === 'scheduled') && (
          <Schedule live={live} onSchedule={(at) => act(() => sessionsApi.schedule(live.id, at))} onCancel={() => act(() => sessionsApi.cancel(live.id))} />
        )}
        {live.status === 'cancelled' && <Alert tone="info">This lesson was cancelled. The group was told.</Alert>}

        {live.segments.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-2xl font-semibold">The lesson, part by part</h2>
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {live.segments.map((segment) => (
                  <SegmentCard
                    key={segment.id}
                    segment={segment}
                    editable={editable}
                    playing={player.playing === segment.id}
                    saying={player.playing === segment.id ? player.saying : null}
                    onListen={() => void player.play(segment)}
                    onStop={player.stop}
                    onSave={async (patch) => {
                      setSegment(await sessionsApi.editSegment(live.id, segment.id, patch))
                      void detail.reload()
                    }}
                    onRemoveImage={async () => {
                      setSegment(await sessionsApi.editSegment(live.id, segment.id, { remove_image: true }))
                      void detail.reload()
                    }}
                    onRewrite={async (instruction) => {
                      try {
                        setSegment(await sessionsApi.rewriteSegment(live.id, segment.id, instruction))
                        void detail.reload()
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'That part could not be rewritten.')
                      }
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}
      </div>
    </Page>
  )
}

/** Follow the lesson being written or recorded while it is. */
function useWork(live: SessionDetail | null, onEvent: (event: WorkEvent) => void) {
  const handler = useRef(onEvent)
  handler.current = onEvent
  const running = live && (live.status === 'planning' || live.status === 'recording')
  const id = live?.id
  useEffect(() => {
    if (!running || !id) return
    const stop = new AbortController()
    void (async () => {
      try {
        for await (const event of followWork(id, stop.signal)) handler.current(event)
      } catch {
        // The stream closed; the page reloads what it needs.
      }
    })()
    return () => stop.abort()
  }, [running, id])
}

function Prepare({
  live,
  onChange,
  onWrite,
  setError,
}: {
  live: SessionDetail
  onChange: () => void
  onWrite: () => void
  setError: (message: string | null) => void
}) {
  const file = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setError(null)
    try {
      for (const f of Array.from(files)) await sessionsApi.upload(live.id, f)
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.')
    } finally {
      setUploading(false)
      if (file.current) file.current.value = ''
    }
  }
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="p-5">
        <h2 className="font-display text-xl font-semibold">Your materials (optional)</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          PDF, Word, PowerPoint or text. Astra teaches from these first, and only fills gaps from the web.
        </p>
        <ul className="mb-3 space-y-2">
          {live.documents.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2">
              <FileText weight="duotone" className="size-5 shrink-0 text-kind-live" aria-hidden />
              <span className="min-w-0 flex-1 break-all text-sm font-semibold">{d.filename}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{d.words} words</span>
              <button type="button" aria-label={`Remove ${d.filename}`} onClick={() => void sessionsApi.removeDocument(live.id, d.id).then(onChange)} className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-muted">
                <X weight="bold" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <input ref={file} type="file" multiple accept=".pdf,.docx,.pptx,.txt,.md" className="sr-only" id="live-files" onChange={(e) => void upload(e.target.files)} />
        <Button variant="outline" size="sm" onClick={() => file.current?.click()} disabled={uploading || live.documents.length >= 5}>
          <UploadSimple weight="bold" className="size-4" aria-hidden />
          {uploading ? 'Reading…' : 'Add files'}
        </Button>
      </Card>
      <Card className="flex flex-col justify-between gap-4 bg-kind-live-vivid/10 p-5">
        <div>
          <h2 className="font-display text-xl font-semibold">Ready to write it?</h2>
          <p className="text-sm text-muted-foreground">
            Astra writes {live.settings.breakdown.length} part{live.settings.breakdown.length === 1 ? '' : 's'} — {live.settings.breakdown.join(', ')} — for you to check. It takes a minute or two.
          </p>
        </div>
        <Button onClick={onWrite} className="w-fit">
          <Sparkle weight="fill" className="size-4" aria-hidden />
          {live.status === 'failed' ? 'Try writing it again' : 'Write the lesson'}
        </Button>
      </Card>
    </div>
  )
}

function Writing({ stage, parts, written }: { stage: string | null; parts: string[]; written: number }) {
  return (
    <Card className="flex flex-wrap items-center gap-5 p-5">
      <AstraBadge size={110} />
      <div className="min-w-[min(100%,16rem)] flex-1">
        <h2 className="font-display text-xl font-semibold">Writing the lesson…</h2>
        <p className="shimmer mb-3 font-semibold text-muted-foreground">{stage ?? 'Getting started'}</p>
        <ol className="flex flex-wrap gap-2">
          {parts.map((p, i) => (
            <motion.li
              key={p}
              initial={{ opacity: 0.5, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...spring.gentle, delay: i * 0.05 }}
              className={cn('rounded-full px-3 py-1 text-sm font-bold', stage?.includes(p) ? 'bg-kind-live-vivid text-white' : 'bg-muted')}
            >
              {i + 1}. {p}
            </motion.li>
          ))}
        </ol>
        {written > 0 && <p className="mt-2 text-sm text-muted-foreground">{written} segment{written === 1 ? '' : 's'} written so far — they appear below.</p>}
      </div>
    </Card>
  )
}

function Recording({ progress }: { progress: { done: number; total: number } | null }) {
  const share = progress && progress.total ? progress.done / progress.total : 0
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-4">
        <AstraBadge size={90} mood="happy" />
        <div className="min-w-[min(100%,16rem)] flex-1">
          <h2 className="font-display text-xl font-semibold">Recording Astra's voice…</h2>
          <p className="text-sm text-muted-foreground">
            {progress ? `${progress.done} of ${progress.total} sentences` : 'Getting the microphone ready'} — once, so the lesson never waits.
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
            <motion.div className="h-full rounded-full bg-kind-live-vivid" animate={{ width: `${Math.max(4, share * 100)}%` }} transition={spring.gentle} />
          </div>
        </div>
      </div>
    </Card>
  )
}

function ActionBar({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-wrap items-center gap-4 border-kind-live-vivid/40 bg-kind-live-vivid/10 p-5">
      <div className="min-w-[min(100%,16rem)] flex-1">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </Card>
  )
}

function Schedule({
  live,
  onSchedule,
  onCancel,
}: {
  live: SessionDetail
  onSchedule: (at: string | null) => Promise<void>
  onCancel: () => Promise<void>
}) {
  const soon = new Date(Date.now() + 60 * 60 * 1000)
  soon.setMinutes(0, 0, 0)
  const [at, setAt] = useState(live.scheduled_at ? toLocalInput(new Date(live.scheduled_at)) : toLocalInput(soon))
  const scheduled = live.status === 'scheduled'
  return (
    <Card className="border-kind-live-vivid/40 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[min(100%,16rem)] flex-1">
          <h2 className="font-display text-xl font-semibold">{scheduled ? 'On the schedule' : 'Ready — when should it happen?'}</h2>
          <p className="text-sm text-muted-foreground">
            {scheduled && live.scheduled_at
              ? `${whenLabel(live.scheduled_at)}. ${live.students} student${live.students === 1 ? ' has' : 's have'} it on their schedule and will be reminded to join.`
              : `It goes onto ${live.group_name}'s schedule, and each student is told.`}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="min-w-[min(100%,14rem)] flex-1">
          <span className="mb-1 block text-sm font-bold">{scheduled ? 'Move it to' : 'Start at'}</span>
          <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </label>
        <Button onClick={() => void onSchedule(new Date(at).toISOString())} disabled={!at}>
          <CalendarPlus weight="bold" className="size-4" aria-hidden />
          {scheduled ? 'Move it' : 'Put it on the schedule'}
        </Button>
        {!scheduled && (
          <Button variant="sun" onClick={() => void onSchedule(null)}>
            <Play weight="fill" className="size-4" aria-hidden />
            Start now
          </Button>
        )}
        {scheduled && (
          <ButtonLink to={`/live/${live.id}/room`} variant="sun">
            <Play weight="fill" className="size-4" aria-hidden />
            Open the room
          </ButtonLink>
        )}
        {scheduled && (
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm('Cancel this lesson? The group will be told.')) void onCancel()
            }}
          >
            <X weight="bold" className="size-4" aria-hidden />
            Cancel the lesson
          </Button>
        )}
      </div>
    </Card>
  )
}
