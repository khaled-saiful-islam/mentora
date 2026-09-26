/**
 * How a material looks wherever it appears: an icon in its file type's
 * colour, and the upload zone that takes new ones.
 */
import { CloudArrowUp, FileDoc, FilePdf, FilePpt, FileText, type Icon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import { Spinner } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { cn } from '@/lib/utils'
import { useCalmMotion } from '@/motion'
import { ACCEPT, materialsApi, type Material } from './api'

const LOOKS: Record<string, { Icon: Icon; tile: string; label: string }> = {
  pdf: { Icon: FilePdf, tile: 'bg-coral-100 text-coral-700 dark:bg-coral-700/30 dark:text-coral-100', label: 'PDF' },
  docx: { Icon: FileDoc, tile: 'bg-sky-100 text-sky-700 dark:bg-sky-700/30 dark:text-sky-100', label: 'Word' },
  pptx: { Icon: FilePpt, tile: 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300', label: 'Slides' },
  text: { Icon: FileText, tile: 'bg-grape-100 text-grape-700 dark:bg-grape-800/40 dark:text-grape-100', label: 'Text' },
}

export function lookOfMaterial(kind: string) {
  return LOOKS[kind] ?? LOOKS.text
}

export function MaterialIcon({ kind, className }: { kind: string; className?: string }) {
  const look = lookOfMaterial(kind)
  return (
    <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', look.tile, className)}>
      <look.Icon weight="duotone" className="size-6" aria-hidden />
    </span>
  )
}

/** Drop files here, or tap to choose. Uploads one after another. */
export function UploadZone({ onAdded, compact = false }: { onAdded: (material: Material) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState<string[]>([])
  const { toast } = useToast()
  const calm = useCalmMotion()

  async function take(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      setBusy((now) => [...now, file.name])
      try {
        onAdded(await materialsApi.upload(file))
        toast(`${file.name} is in your materials`, { tone: 'success' })
      } catch (e) {
        toast(`Couldn't add ${file.name}`, { tone: 'error', body: errorMessage(e) })
      } finally {
        setBusy((now) => now.filter((n) => n !== file.name))
      }
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        void take(e.dataTransfer.files)
      }}
      className={cn(
        'relative flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed text-center transition-colors',
        compact ? 'p-4' : 'p-8',
        over ? 'border-primary bg-primary/5' : 'border-border hover:border-hover-border',
      )}
    >
      <motion.span
        animate={calm ? undefined : over ? { y: -6, scale: 1.1 } : { y: [0, -4, 0] }}
        transition={over ? { type: 'spring', stiffness: 300 } : { duration: 2.4, repeat: Infinity }}
        className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"
      >
        <CloudArrowUp weight="duotone" className="size-7" aria-hidden />
      </motion.span>
      <p className="font-bold">
        {over ? 'Let go to add them' : 'Drop your files here, or '}
        {!over && (
          <button type="button" onClick={() => input.current?.click()} className="font-bold text-primary underline-offset-2 hover:underline">
            choose files
          </button>
        )}
      </p>
      <p className="text-sm text-muted-foreground">PDF, Word, PowerPoint or text · up to 10 MB each</p>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        aria-label="Choose files to add to your materials"
        onChange={(e) => {
          if (e.target.files) void take(e.target.files)
          e.target.value = ''
        }}
      />
      <AnimatePresence>
        {busy.length > 0 && (
          <motion.ul initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 space-y-1 text-sm">
            {busy.map((name) => (
              <li key={name} className="flex items-center justify-center gap-2 font-semibold">
                <Spinner className="size-4" /> Reading {name}…
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
