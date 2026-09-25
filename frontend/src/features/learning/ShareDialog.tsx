import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Broadcast, Check, Lightning, Trophy, UsersFour, UsersThree } from '@phosphor-icons/react'
import { Alert, Button, Field, Skeleton } from '@/components/ui'
import { Dialog } from '@/components/ui/Dialog'
import { Segmented } from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { classesApi } from '@/features/classes/api'
import { useResource } from '@/hooks/useResource'
import { celebrate, spring, useCalmMotion } from '@/motion'
import { lookOf } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { learningApi, type SetDetail } from './api'

/**
 * Share a set: which class, whole class or some groups, and how it plays —
 * instant or end-of-quiz feedback, a due date, retakes, the leaderboard.
 */
export function ShareDialog({ open, set, onClose }: { open: boolean; set: SetDetail; onClose: () => void }) {
  const classes = useResource(open ? 'share:classes' : null, () => classesApi.list())
  const [classId, setClassId] = useState<string | null>(null)
  const groups = useResource(classId ? `share:groups:${classId}` : null, () => classesApi.groups(classId!))
  const [audience, setAudience] = useState<'class' | 'groups'>('class')
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState<'instant' | 'end'>('instant')
  const [due, setDue] = useState('')
  const [retakes, setRetakes] = useState(set.kind === 'flashcard')
  const [shuffle, setShuffle] = useState(false)
  const [leaderboard, setLeaderboard] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const calm = useCalmMotion()
  const quiz = set.kind === 'quiz'
  const items = classes.data?.items ?? []

  useEffect(() => {
    if (open && !classId && items.length === 1) setClassId(items[0].id)
  }, [open, classId, items])
  useEffect(() => {
    setChosen(new Set())
    setAudience('class')
  }, [classId])

  const room = useMemo(() => items.find((c) => c.id === classId), [items, classId])

  async function share() {
    if (!classId) return
    setBusy(true)
    setError(null)
    try {
      const shared = await learningApi.share({
        set_id: set.id,
        class_id: classId,
        group_ids: audience === 'groups' ? Array.from(chosen) : [],
        feedback_mode: feedback,
        due_at: due ? new Date(due).toISOString() : null,
        allow_retakes: retakes,
        max_attempts: null,
        shuffle_questions: shuffle,
        shuffle_options: true,
        leaderboard_enabled: quiz && leaderboard,
      })
      celebrate({ calm, power: 0.6 })
      toast(`Shared with ${shared.audience} ${shared.audience === 1 ? 'student' : 'students'}!`, { body: `${shared.class_name}${shared.group_names.length ? ` · ${shared.group_names.join(', ')}` : ''}` })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const blocked = !classId || (audience === 'groups' && chosen.size === 0)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Share “${set.title}”`}
      description="Students get a notification and it appears on their home."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void share()} loading={busy} disabled={blocked}>
            <Broadcast weight="bold" className="size-5" /> Share now
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <p className="mb-2 text-sm font-bold">Class</p>
          {classes.loading && !classes.data ? (
            <Skeleton className="h-16" />
          ) : items.length === 0 ? (
            <Alert tone="info">Make a class first — then you can share with it.</Alert>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((c) => {
                const look = lookOf(c.theme)
                const on = c.id === classId
                return (
                  <motion.button key={c.id} type="button" whileTap={{ scale: 0.97 }} onClick={() => setClassId(c.id)} aria-pressed={on} className={cn('flex items-center gap-3 rounded-2xl border-2 p-2.5 text-left', on ? 'border-primary bg-grape-50 dark:bg-grape-900/30' : 'border-border hover:border-hover-border')}>
                    <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', look.hero, look.onHero)}><UsersThree weight="fill" className="size-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-bold">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">{c.students} students</span>
                    </span>
                    {on && <Check weight="bold" className="size-5 text-primary" />}
                  </motion.button>
                )
              })}
            </div>
          )}
        </section>

        {room && (
          <section>
            <p className="mb-2 text-sm font-bold">Who</p>
            <Segmented label="Who" value={audience} onChange={setAudience} options={[{ value: 'class', label: `Whole class (${room.students})` }, { value: 'groups', label: 'Some groups', icon: <UsersFour weight="bold" className="size-4" /> }]} />
            {audience === 'groups' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(groups.data?.items ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">This class has no groups yet.</p>
                ) : (
                  groups.data!.items.map((g) => {
                    const on = chosen.has(g.id)
                    return (
                      <motion.button key={g.id} type="button" whileTap={{ scale: 0.92 }} animate={{ scale: on ? 1.05 : 1 }} transition={spring.bouncy} aria-pressed={on} onClick={() => setChosen((all) => { const next = new Set(all); if (next.has(g.id)) next.delete(g.id); else next.add(g.id); return next })} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ring-2', on ? cn(lookOf(g.colour).hero, lookOf(g.colour).onHero, 'ring-transparent') : 'bg-surface ring-border')}>
                        {on && <Check weight="bold" className="size-4" />}
                        {g.name} · {g.member_ids.length}
                      </motion.button>
                    )
                  })
                )}
              </div>
            )}
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          {quiz && (
            <div>
              <p className="mb-2 text-sm font-bold">Feedback</p>
              <Segmented label="Feedback" value={feedback} onChange={setFeedback} options={[{ value: 'instant', label: 'After each', icon: <Lightning weight="fill" className="size-4" /> }, { value: 'end', label: 'At the end' }]} />
            </div>
          )}
          <Field label="Due (optional)" htmlFor="share-due">
            <input id="share-due" type="datetime-local" value={due} min={localNow()} onChange={(e) => setDue(e.target.value)} className="h-12 w-full rounded-2xl border-2 border-input bg-surface px-3 font-semibold focus-visible:border-primary focus-visible:outline-none" />
          </Field>
        </section>

        <section className="space-y-2">
          <Toggle label={quiz ? 'Allow retakes' : 'Allow practising again'} hint={quiz ? "The first try counts for the leaderboard." : 'Flashcards are for practice — usually on.'} on={retakes} onChange={setRetakes} />
          {quiz && <Toggle label="Shuffle question order" hint="Answer options are always shuffled for each student." on={shuffle} onChange={setShuffle} />}
          {quiz && <Toggle label="Show a leaderboard" hint="Students see the top 10 and their own rank — never the bottom." on={leaderboard} onChange={setLeaderboard} icon={<Trophy weight="duotone" className="size-5 text-sun-600" />} />}
        </section>
        {error && <Alert>{error}</Alert>}
      </div>
    </Dialog>
  )
}

function Toggle({ label, hint, on, onChange, icon }: { label: string; hint?: string; on: boolean; onChange: (on: boolean) => void; icon?: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl p-2 hover:bg-hover">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', on ? 'bg-primary' : 'bg-border')}>
        <motion.span layout transition={spring.snappy} className={cn('absolute top-1 size-5 rounded-full bg-white shadow', on ? 'right-1' : 'left-1')} />
      </button>
    </label>
  )
}

function localNow(): string {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
  return now.toISOString().slice(0, 16)
}
