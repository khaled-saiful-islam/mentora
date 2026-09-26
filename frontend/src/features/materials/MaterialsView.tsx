/**
 * My materials: a teacher's own files — worksheets, chapters, notes — kept
 * once and made from again and again (PLAN.md §21).
 */
import { MagnifyingGlass, PencilSimple, Sparkle, Trash } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Alert, Button, Card, Input, Skeleton } from '@/components/ui'
import { Confirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { useLearnStudio } from '@/features/learning/LearnStudio'
import { useResource } from '@/hooks/useResource'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { rise, stagger } from '@/motion'
import { materialsApi, sizeLine, type Material } from './api'
import { lookOfMaterial, MaterialIcon, UploadZone } from './MaterialBits'

export function MaterialsView() {
  const [q, setQ] = useState('')
  const materials = useResource(`materials:${q}`, () => materialsApi.list(q || undefined))
  const items = materials.data?.items ?? []

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <div className="relative">
            <MagnifyingGlass weight="bold" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search your materials" placeholder="Search your files — by name or by what's in them" value={q} onChange={(e) => setQ(e.target.value)} className="pl-11" />
          </div>
          {materials.error && <Alert>{materials.error}</Alert>}
          {!materials.data ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-40 rounded-3xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="p-6 text-muted-foreground">
              {q ? 'Nothing in your files matches that.' : 'No files yet. Add the worksheets, chapters and notes you teach from — then make quizzes, flashcards, study guides and live lessons from them.'}
            </Card>
          ) : (
            <motion.ul className={cn('grid gap-4', items.length > 1 && 'sm:grid-cols-2')} variants={stagger(0.05)} initial="hidden" animate="shown">
              {items.map((m) => (
                <MaterialCard key={m.id} material={m} onChanged={() => void materials.reload()} />
              ))}
            </motion.ul>
          )}
        </div>
        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <UploadZone onAdded={() => void materials.reload()} />
          {materials.data && (
            <p className="text-center text-xs font-bold text-muted-foreground">
              {items.length} of {materials.data.limit} files · kept private to you
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

function MaterialCard({ material, onChanged }: { material: Material; onChanged: () => void }) {
  const studio = useLearnStudio()
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(material.title)
  const [removing, setRemoving] = useState(false)
  const { toast } = useToast()
  const look = lookOfMaterial(material.kind)

  async function rename(event: React.FormEvent) {
    event.preventDefault()
    try {
      await materialsApi.rename(material.id, title)
      setRenaming(false)
      onChanged()
    } catch (e) {
      toast('Could not rename it', { tone: 'error', body: errorMessage(e) })
    }
  }

  async function remove() {
    setRemoving(false)
    try {
      await materialsApi.remove(material.id)
      toast(`${material.title} is gone from your materials`, { tone: 'info', body: 'What you already made from it stays.' })
      onChanged()
    } catch (e) {
      toast('Could not remove it', { tone: 'error', body: errorMessage(e) })
    }
  }

  return (
    <motion.li variants={rise} layout className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <MaterialIcon kind={material.kind} />
        <div className="min-w-0 flex-1">
          {renaming ? (
            <form onSubmit={rename} className="flex gap-2">
              <Input aria-label="New name" autoFocus value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className="h-10" />
              <Button type="submit" size="sm">Save</Button>
            </form>
          ) : (
            <p className="break-words font-bold leading-snug">{material.title}</p>
          )}
          <p className="text-xs font-bold text-muted-foreground">
            {look.label} · {sizeLine(material)} · added {timeAgo(material.created_at)}
          </p>
        </div>
      </div>
      {material.preview && <p className="rounded-2xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{material.preview}…</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => studio.create('quiz', material.title, [material])}>
          <Sparkle weight="fill" className="size-4" /> Make from this
        </Button>
        <Button size="sm" variant="ghost" aria-label={`Rename ${material.title}`} onClick={() => setRenaming((r) => !r)}>
          <PencilSimple weight="bold" className="size-4" />
        </Button>
        <Button size="sm" variant="ghost" aria-label={`Remove ${material.title}`} onClick={() => setRemoving(true)}>
          <Trash weight="bold" className="size-4" />
        </Button>
      </div>
      {removing && (
        <Confirm
          title={`Remove ${material.title}?`}
          body="It leaves your materials. Quizzes, decks and lessons you already made from it are kept."
          confirmLabel="Remove"
          onConfirm={() => void remove()}
          onCancel={() => setRemoving(false)}
        />
      )}
    </motion.li>
  )
}
