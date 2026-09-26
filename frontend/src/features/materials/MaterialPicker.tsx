/**
 * Choose from your materials — or add a new file on the spot — to make
 * something from.
 */
import { Check, MagnifyingGlass } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Button, Input, Skeleton } from '@/components/ui'
import { Dialog } from '@/components/ui/Dialog'
import { useResource } from '@/hooks/useResource'
import { cn } from '@/lib/utils'
import { spring } from '@/motion'
import { materialsApi, sizeLine, type Material } from './api'
import { MaterialIcon, UploadZone } from './MaterialBits'

export function MaterialPicker({
  open,
  chosen,
  onClose,
  onChoose,
  max = 10,
  title = 'Use my materials',
}: {
  open: boolean
  chosen: Material[]
  onClose: () => void
  onChoose: (materials: Material[]) => void
  max?: number
  title?: string
}) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Material[]>(chosen)
  const materials = useResource(`materials-pick:${q}`, () => materialsApi.list(q || undefined))
  useEffect(() => {
    if (open) setPicked(chosen)
  }, [open, chosen])

  const has = (m: Material) => picked.some((p) => p.id === m.id)
  const toggle = (m: Material) => setPicked((now) => (has(m) ? now.filter((p) => p.id !== m.id) : now.length < max ? [...now, m] : now))
  const items = materials.data?.items ?? []

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description="The quiz is made from these first — your own words and examples."
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-sm font-bold text-muted-foreground">{picked.length} chosen</span>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onChoose(picked)}>Use {picked.length || ''} {picked.length === 1 ? 'file' : 'files'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <UploadZone
          compact
          onAdded={(m) => {
            void materials.reload()
            setPicked((now) => (now.length < max && !now.some((p) => p.id === m.id) ? [...now, m] : now))
          }}
        />
        <div className="relative">
          <MagnifyingGlass weight="bold" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search your materials" placeholder="Search your files" value={q} onChange={(e) => setQ(e.target.value)} className="pl-11" />
        </div>
        {!materials.data ? (
          <Skeleton className="h-32 rounded-3xl" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{q ? 'Nothing matches that.' : 'No files yet — add one above.'}</p>
        ) : (
          <ul className="space-y-2" role="listbox" aria-multiselectable aria-label="Your materials">
            {items.map((m) => {
              const on = has(m)
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => toggle(m)}
                    className={cn('flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors', on ? 'border-primary bg-primary/5' : 'border-border hover:border-hover-border')}
                  >
                    <MaterialIcon kind={m.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-bold leading-snug">{m.title}</span>
                      <span className="block text-xs font-bold text-muted-foreground">{sizeLine(m)}</span>
                    </span>
                    <motion.span
                      animate={{ scale: on ? 1 : 0.6, opacity: on ? 1 : 0.3 }}
                      transition={spring.bouncy}
                      className={cn('grid size-7 shrink-0 place-items-center rounded-full', on ? 'bg-primary text-primary-foreground' : 'border-2 border-border')}
                    >
                      {on && <Check weight="bold" className="size-4" aria-hidden />}
                    </motion.span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Dialog>
  )
}
