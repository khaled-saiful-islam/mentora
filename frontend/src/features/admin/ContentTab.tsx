/**
 * Everything people have made, whoever made it: quiz and flashcard sets, and
 * studio pieces. For looking, not editing — previews run sandboxed, exactly
 * as they do for their owner.
 */
import { motion } from 'motion/react'
import { Check, MagnifyingGlass, Sparkle } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Alert, Chip, Input, Skeleton } from '@/components/ui'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { lookOfKind, nounOf } from '@/features/learning/kinds'
import { useResource } from '@/hooks/useResource'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { rise, stagger } from '@/motion'
import { adminApi, type ContentArtifact, type ContentSet } from './api'

const SHELVES = [
  { value: 'sets', label: 'Quizzes & cards' },
  { value: 'studio', label: 'Studio' },
] as const

export function ContentTab() {
  const [shelf, setShelf] = useState<(typeof SHELVES)[number]['value']>('sets')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [openSet, setOpenSet] = useState<ContentSet | null>(null)
  const [openArtifact, setOpenArtifact] = useState<ContentArtifact | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(q), 300)
    return () => window.clearTimeout(timer)
  }, [q])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Show" value={shelf} onChange={setShelf} options={SHELVES} />
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">Search content</span>
          <MagnifyingGlass weight="bold" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, topics or makers" className="pl-10" />
        </label>
      </div>
      <div className="mt-4">
        {shelf === 'sets' ? <Sets search={search} onOpen={setOpenSet} /> : <Studio search={search} onOpen={setOpenArtifact} />}
      </div>
      {openSet && <SetPreview set={openSet} onClose={() => setOpenSet(null)} />}
      {openArtifact && (
        <Dialog open onClose={() => setOpenArtifact(null)} title={openArtifact.title} description={`${openArtifact.kind} by ${openArtifact.owner.name}`} size="lg">
          <iframe
            title={openArtifact.title}
            src={adminApi.artifactUrl(openArtifact.id)}
            // No same-origin: the document gets an opaque origin, so it cannot
            // read the admin's session. Its own CSP still applies on top.
            sandbox="allow-scripts"
            className="h-[70vh] w-full rounded-2xl border-2 border-border bg-white"
          />
        </Dialog>
      )}
    </div>
  )
}

function Owner({ name, role }: { name: string; role: string }) {
  return (
    <span className="text-sm text-muted-foreground">
      {name} · <span className="capitalize">{role}</span>
    </span>
  )
}

function Sets({ search, onOpen }: { search: string; onOpen: (set: ContentSet) => void }) {
  const sets = useResource(`admin-sets-${search}`, () => adminApi.sets({ q: search }))
  if (sets.error) return <Alert>{sets.error}</Alert>
  if (!sets.data) return <Rows />
  if (sets.data.length === 0) return <EmptyState art={<EmptyArt Icon={Sparkle} />} title="Nothing found" />
  return (
    <motion.ul className="grid gap-3 sm:grid-cols-2" variants={stagger(0.03)} initial="hidden" animate="shown">
      {sets.data.map((set) => {
        const look = lookOfKind(set.kind)
        return (
          <motion.li key={set.id} variants={rise}>
            <button type="button" onClick={() => onOpen(set)} className="flex w-full items-start gap-3 rounded-2xl border-2 border-border bg-surface p-3 text-left transition-colors hover:border-hover-border">
              <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', look.hero)}>
                <look.Icon weight="fill" className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words font-bold">{set.title}</span>
                <Owner name={set.owner.name} role={set.owner.role} />
                <span className="mt-1 flex flex-wrap gap-1.5">
                  <Chip>{nounOf(set.kind, set.item_count)}</Chip>
                  {set.purpose === 'practice' && <Chip tone="sun">Practice</Chip>}
                  {set.shares > 0 && <Chip tone="mint">Shared {set.shares}×</Chip>}
                  {set.status !== 'ready' && <Chip tone="coral" className="capitalize">{set.status}</Chip>}
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(set.created_at)}</span>
            </button>
          </motion.li>
        )
      })}
    </motion.ul>
  )
}

function Studio({ search, onOpen }: { search: string; onOpen: (artifact: ContentArtifact) => void }) {
  const artifacts = useResource(`admin-artifacts-${search}`, () => adminApi.artifacts({ q: search }))
  if (artifacts.error) return <Alert>{artifacts.error}</Alert>
  if (!artifacts.data) return <Rows />
  if (artifacts.data.length === 0) return <EmptyState art={<EmptyArt Icon={Sparkle} />} title="Nothing found" />
  return (
    <motion.ul className="grid gap-3 sm:grid-cols-2" variants={stagger(0.03)} initial="hidden" animate="shown">
      {artifacts.data.map((artifact) => (
        <motion.li key={artifact.id} variants={rise}>
          <button type="button" onClick={() => onOpen(artifact)} className="flex w-full items-start gap-3 rounded-2xl border-2 border-border bg-surface p-3 text-left transition-colors hover:border-hover-border">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-grape-100 text-grape-700 dark:bg-grape-800/40 dark:text-grape-100">
              <Sparkle weight="fill" className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-words font-bold">{artifact.title}</span>
              <Owner name={artifact.owner.name} role={artifact.owner.role} />
              <span className="mt-1 flex gap-1.5">
                <Chip className="capitalize">{artifact.kind}</Chip>
                <Chip>v{artifact.version}</Chip>
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(artifact.updated_at)}</span>
          </button>
        </motion.li>
      ))}
    </motion.ul>
  )
}

function Rows() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  )
}

function SetPreview({ set, onClose }: { set: ContentSet; onClose: () => void }) {
  const detail = useResource(`admin-set-${set.id}`, () => adminApi.set(set.id))
  return (
    <Dialog open onClose={onClose} title={set.title} description={[set.subject, set.grade_label, `by ${set.owner.name}`].filter(Boolean).join(' · ')} size="lg">
      {detail.error && <Alert>{detail.error}</Alert>}
      {!detail.data ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : (
        <ol className="space-y-3">
          {detail.data.items.map((item, i) => (
            <li key={String(item.id ?? i)} className="rounded-2xl bg-muted/50 p-3">
              {Array.isArray(item.options) ? (
                <>
                  <p className="font-bold">{i + 1}. {String(item.prompt)}</p>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {(item.options as string[]).map((option, n) => (
                      <li key={n} className={cn('flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm', n === item.answer ? 'bg-correct-soft font-bold' : 'bg-surface')}>
                        {n === item.answer && <Check weight="bold" className="size-4 text-success" />}
                        {option}
                      </li>
                    ))}
                  </ul>
                  {item.explanation ? <p className="mt-2 text-sm text-muted-foreground">{String(item.explanation)}</p> : null}
                </>
              ) : (
                <>
                  <p className="font-bold">{String(item.front)}</p>
                  <p className="text-sm">{String(item.back)}</p>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  )
}
