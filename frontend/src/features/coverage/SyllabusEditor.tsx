/**
 * The syllabus, the teacher's to change: rename, add and remove areas and
 * topics. Ids ride along untouched, so whatever was sorted onto a topic
 * stays there after an edit; a removed topic's lessons are sorted again.
 */
import { Plus, Trash } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Alert, Button, Input } from '@/components/ui'
import { Dialog } from '@/components/ui/Dialog'
import { errorMessage } from '@/features/auth/errors'
import { rise } from '@/motion'
import type { SyllabusArea } from './api'

const MAX_AREAS = 12
const MAX_TOPICS = 8

export function SyllabusEditor({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial: SyllabusArea[]
  onClose: () => void
  onSave: (areas: SyllabusArea[]) => Promise<void>
}) {
  const [areas, setAreas] = useState<SyllabusArea[]>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAreas(initial.length ? initial : [blankArea()])
      setError(null)
    }
  }, [open, initial])

  const patchArea = (index: number, next: Partial<SyllabusArea>) =>
    setAreas((all) => all.map((a, i) => (i === index ? { ...a, ...next } : a)))

  async function save() {
    const cleaned = areas
      .map((a) => ({ ...a, title: a.title.trim(), topics: a.topics.map((t) => ({ ...t, title: t.title.trim() })).filter((t) => t.title) }))
      .filter((a) => a.title)
    if (cleaned.length === 0) {
      setError('Give the syllabus at least one area with a name.')
      return
    }
    setBusy(true)
    try {
      await onSave(cleaned)
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="The year's syllabus"
      description="Areas in the order you teach them, each with its topics. Everything you share is sorted onto these."
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={busy}>
            Save syllabus
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {areas.map((area, index) => (
            <motion.section key={area.id || `new-${index}`} variants={rise} initial="hidden" animate="shown" exit={{ opacity: 0, height: 0 }} className="rounded-3xl border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 font-display font-semibold text-primary">{index + 1}</span>
                <Input aria-label={`Area ${index + 1}`} value={area.title} maxLength={80} placeholder="Area, e.g. Living things" onChange={(e) => patchArea(index, { title: e.target.value })} />
                <Button variant="ghost" size="icon" aria-label={`Remove ${area.title || 'this area'}`} onClick={() => setAreas((all) => all.filter((_, i) => i !== index))}>
                  <Trash weight="bold" className="size-4" />
                </Button>
              </div>
              <ul className="mt-3 space-y-2 pl-10">
                {area.topics.map((topic, t) => (
                  <li key={topic.id || `t-${t}`} className="flex items-center gap-2">
                    <Input
                      aria-label={`Topic ${t + 1} of ${area.title || `area ${index + 1}`}`}
                      value={topic.title}
                      maxLength={100}
                      placeholder="Topic, e.g. How plants make food"
                      className="h-10"
                      onChange={(e) => patchArea(index, { topics: area.topics.map((x, j) => (j === t ? { ...x, title: e.target.value } : x)) })}
                    />
                    <Button variant="ghost" size="icon" aria-label={`Remove ${topic.title || 'this topic'}`} onClick={() => patchArea(index, { topics: area.topics.filter((_, j) => j !== t) })}>
                      <Trash weight="bold" className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              {area.topics.length < MAX_TOPICS && (
                <Button variant="ghost" size="sm" className="mt-2 ml-10" onClick={() => patchArea(index, { topics: [...area.topics, { id: '', title: '' }] })}>
                  <Plus weight="bold" className="size-4" /> Add a topic
                </Button>
              )}
            </motion.section>
          ))}
        </AnimatePresence>
        {areas.length < MAX_AREAS && (
          <Button variant="outline" onClick={() => setAreas((all) => [...all, blankArea()])}>
            <Plus weight="bold" className="size-4" /> Add an area
          </Button>
        )}
        {error && <Alert>{error}</Alert>}
      </div>
    </Dialog>
  )
}

function blankArea(): SyllabusArea {
  return { id: '', title: '', topics: [{ id: '', title: '' }] }
}
