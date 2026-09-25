import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Broadcast,
  FloppyDisk,
  Globe,
  MagicWand,
  Plus,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { Alert, Button, Card, Input, Skeleton } from '@/components/ui'
import { Confirm } from '@/components/ui/Confirm'
import { TextSizeControl } from '@/components/ui/TextSizeControl'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { useResource } from '@/hooks/useResource'
import { Page, spring } from '@/motion'
import { cn } from '@/lib/utils'
import { learningApi, type Item, type SetDetail } from './api'
import { EDITORS } from './editors'
import { lookOfKind } from './kinds'
import { ShareDialog } from './ShareDialog'

export default function EditorPage() {
  const { setId = '' } = useParams()
  const loaded = useResource(`set:${setId}`, () => learningApi.get(setId))
  if (loaded.error) {
    return (
      <Page className="mx-auto max-w-3xl px-4 py-10">
        <Alert>{loaded.error}</Alert>
        <Link to="/library" className="mt-4 inline-block font-bold text-primary">Back to the library</Link>
      </Page>
    )
  }
  if (!loaded.data) return <Page className="mx-auto max-w-5xl px-4 py-8"><Skeleton className="h-40 rounded-[2rem]" /></Page>
  return <Editor key={`${loaded.data.id}:${loaded.data.version}`} initial={loaded.data} onSaved={loaded.setData} />
}

function Editor({ initial, onSaved }: { initial: SetDetail; onSaved: (set: SetDetail) => void }) {
  const [title, setTitle] = useState(initial.title)
  const [items, setItems] = useState<Item[]>(initial.items)
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const { toast } = useToast()
  const kind = EDITORS[initial.kind]
  const look = lookOfKind(initial.kind)
  const dirty = title !== initial.title || JSON.stringify(items) !== JSON.stringify(initial.items)
  const problems = useMemo(() => items.map((item) => kind.problem(item)), [items, kind])
  const firstProblem = problems.findIndex(Boolean)

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  async function save() {
    setSaving(true)
    try {
      const saved = await learningApi.edit(initial.id, { title, items })
      toast(saved.version > initial.version ? `Saved as version ${saved.version}` : 'Saved', {
        body: saved.version > initial.version ? 'Students already working keep the version they were given.' : undefined,
      })
      onSaved(saved)
    } catch (error) {
      toast('Could not save', { tone: 'error', body: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const move = (from: number, to: number) =>
    setItems((all) => {
      if (to < 0 || to >= all.length) return all
      const next = [...all]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  const replace = (index: number, item: Item) => setItems((all) => all.map((it, i) => (i === index ? item : it)))
  const add = () => setItems((all) => [...all, { ...kind.blank(initial.skills[0]?.slug ?? 'general'), id: newId() }])

  return (
    <Page className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
      <Link to="/library" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft weight="bold" className="size-4" /> Library
      </Link>

      <section className={cn('relative mt-4 overflow-hidden rounded-[2rem] p-6 shadow-press sm:p-8', look.hero)}>
        <span className="blob -right-10 -top-16 size-56 bg-white/40" aria-hidden />
        <div className="relative flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-2 font-bold opacity-90">
              <look.Icon weight="duotone" className="size-5" />
              {[look.label, initial.subject, initial.grade_label].filter(Boolean).join(' · ')}
            </p>
            <input aria-label="Title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-2xl bg-transparent font-display text-4xl font-semibold tracking-tight outline-none placeholder:text-white/60 focus-visible:bg-white/10 sm:text-5xl" />
            <p className="mt-2 font-bold opacity-90">
              {items.length} {initial.kind === 'quiz' ? 'questions' : 'cards'} · version {initial.version}
              {initial.shares > 0 && ` · shared ${initial.shares}×`}
            </p>
          </div>
          <div className="flex gap-2">
            <TextSizeControl compact className="border-white/30 bg-white/15 text-white [&_button]:text-white" />
            {initial.purpose === 'assign' && (
              <Button variant="secondary" onClick={() => setSharing(true)} disabled={dirty} title={dirty ? 'Save your changes first' : undefined} className="bg-white text-grape-900 hover:bg-white/90">
                <Broadcast weight="bold" className="size-5" /> Share
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {items.map((item, index) => (
              <motion.div key={item.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={spring.gentle}>
                <ItemCard
                  number={index + 1}
                  problem={problems[index]}
                  setId={initial.id}
                  item={item}
                  saved={initial.items.some((i) => i.id === item.id)}
                  onMove={(delta) => move(index, index + delta)}
                  onDelete={() => setDeleting(index)}
                  onReplace={(fresh) => replace(index, fresh)}
                  first={index === 0}
                  last={index === items.length - 1}
                >
                  <kind.Editor item={item} skills={initial.skills} sources={initial.sources} onChange={(changed) => replace(index, changed)} />
                </ItemCard>
              </motion.div>
            ))}
          </AnimatePresence>
          <Button variant="outline" size="lg" className="w-full border-dashed" onClick={add}>
            <Plus weight="bold" className="size-5" /> Add a {initial.kind === 'quiz' ? 'question' : 'card'}
          </Button>
        </div>
        <SourcesPanel set={initial} />
      </div>

      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} transition={spring.snappy} className="fixed inset-x-0 bottom-20 z-40 mx-auto flex w-[min(40rem,calc(100%-2rem))] items-center gap-3 rounded-full border-2 border-grape-200 bg-surface py-2 pl-5 pr-2 shadow-lg md:bottom-6 dark:border-grape-700">
            {firstProblem >= 0 ? (
              <p className="flex-1 truncate text-sm font-bold text-destructive"><WarningCircle weight="fill" className="mr-1 inline size-4" />{`#${firstProblem + 1}: ${problems[firstProblem]}`}</p>
            ) : (
              <p className="flex-1 text-sm font-bold">Unsaved changes</p>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setTitle(initial.title); setItems(initial.items) }}>Undo</Button>
            <Button onClick={() => void save()} loading={saving} disabled={firstProblem >= 0 || items.length === 0}>
              <FloppyDisk weight="bold" className="size-5" /> Save
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {deleting !== null && (
        <Confirm
          title={`Delete ${initial.kind === 'quiz' ? 'question' : 'card'} ${deleting + 1}?`}
          body="It goes when you save. Students already working on a shared version keep theirs."
          onConfirm={() => { setItems((all) => all.filter((_, i) => i !== deleting)); setDeleting(null) }}
          onCancel={() => setDeleting(null)}
        />
      )}
      <ShareDialog open={sharing} set={initial} onClose={() => setSharing(false)} />
    </Page>
  )
}

function ItemCard({
  number, problem, setId, item, saved, onMove, onDelete, onReplace, first, last, children,
}: {
  number: number; problem: string | null; setId: string; item: Item; saved: boolean
  onMove: (delta: number) => void; onDelete: () => void; onReplace: (item: Item) => void
  first: boolean; last: boolean; children: React.ReactNode
}) {
  const [asking, setAsking] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  async function rewrite(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const { item: fresh } = await learningApi.rewrite(setId, item.id, instruction)
      onReplace(fresh)
      setAsking(false)
      setInstruction('')
      toast('Rewritten — save to keep it')
    } catch (error) {
      toast('Could not rewrite', { tone: 'error', body: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={cn('relative p-4 sm:p-5', problem && 'border-destructive/40')}>
      <div className="mb-2 flex items-center gap-1">
        <span className="mr-auto grid size-8 place-items-center rounded-full bg-grape-100 font-display font-semibold text-grape-700 dark:bg-grape-800/50 dark:text-grape-100">{number}</span>
        <IconButton label="Move up" disabled={first} onClick={() => onMove(-1)}><ArrowUp weight="bold" className="size-4" /></IconButton>
        <IconButton label="Move down" disabled={last} onClick={() => onMove(1)}><ArrowDown weight="bold" className="size-4" /></IconButton>
        <IconButton label="Rewrite with AI" disabled={!saved} title={saved ? 'Rewrite with AI' : 'Save first to rewrite this one'} onClick={() => setAsking((a) => !a)}><MagicWand weight="bold" className="size-4" /></IconButton>
        <IconButton label="Delete" onClick={onDelete}><Trash weight="bold" className="size-4" /></IconButton>
      </div>
      <AnimatePresence>
        {asking && (
          <motion.form onSubmit={rewrite} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-3 flex gap-2 overflow-hidden">
            <Input autoFocus placeholder="e.g. make it easier, or ask about leaves" value={instruction} maxLength={300} onChange={(e) => setInstruction(e.target.value)} />
            <Button type="submit" loading={busy}><MagicWand weight="bold" className="size-4" /> Rewrite</Button>
          </motion.form>
        )}
      </AnimatePresence>
      {children}
      {problem && <p className="mt-2 text-sm font-bold text-destructive">{problem}</p>}
    </Card>
  )
}

function IconButton({ label, title, disabled, onClick, children }: { label: string; title?: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={title ?? label} disabled={disabled} onClick={onClick} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground disabled:opacity-30">
      {children}
    </button>
  )
}

function SourcesPanel({ set }: { set: SetDetail }) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Globe weight="duotone" className="size-5 text-sky-700 dark:text-sky-100" /> Sources</h2>
        {set.sources.length === 0 ? (
          <p className="mt-2 text-sm text-warning">No web sources — written from general knowledge. Check each one carefully.</p>
        ) : (
          <ol className="mt-3 space-y-2.5">
            {set.sources.map((s) => (
              <li key={s.id} className="text-sm">
                <a href={s.url} target="_blank" rel="noreferrer noopener" className="font-bold hover:underline">{s.id} · {s.title}</a>
                <p className="text-xs text-muted-foreground">{s.host}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold">Skills</h2>
        <p className="mt-1 text-xs text-muted-foreground">Results show strengths and weaknesses by these.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {set.skills.map((s) => (
            <span key={s.slug} className="rounded-full bg-grape-100 px-2.5 py-1 text-xs font-bold text-grape-800 dark:bg-grape-800/40 dark:text-grape-100">{s.label}</span>
          ))}
        </div>
      </Card>
    </aside>
  )
}

function newId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/-/g, '').slice(0, 12)
}
