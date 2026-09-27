/**
 * How a material looks wherever it appears: an icon in its file type's
 * colour, and the upload zone that takes new ones.
 */
import { Camera, CloudArrowUp, FileDoc, FilePdf, FilePpt, FileText, Image as ImageIcon, type Icon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import { Spinner } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { cn } from '@/lib/utils'
import { useCalmMotion } from '@/motion'
import { ACCEPT, materialsApi, PHOTO_ACCEPT, type Material } from './api'

const LOOKS: Record<string, { Icon: Icon; tile: string; label: string }> = {
  pdf: { Icon: FilePdf, tile: 'bg-coral-100 text-coral-700 dark:bg-coral-700/30 dark:text-coral-100', label: 'PDF' },
  docx: { Icon: FileDoc, tile: 'bg-sky-100 text-sky-700 dark:bg-sky-700/30 dark:text-sky-100', label: 'Word' },
  pptx: { Icon: FilePpt, tile: 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300', label: 'Slides' },
  text: { Icon: FileText, tile: 'bg-grape-100 text-grape-700 dark:bg-grape-800/40 dark:text-grape-100', label: 'Text' },
  image: { Icon: ImageIcon, tile: 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100', label: 'Photo' },
}

export function lookOfMaterial(kind: string) {
  return LOOKS[kind] ?? LOOKS.text
}

export function MaterialIcon({ kind, thumbnail, className }: { kind: string; thumbnail?: string | null; className?: string }) {
  const look = lookOfMaterial(kind)
  if (thumbnail) {
    return <img src={thumbnail} alt="" className={cn('size-11 shrink-0 rounded-2xl object-cover', className)} />
  }
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
      <p className="text-sm text-muted-foreground">PDF, Word, PowerPoint, text or a photo · up to 10 MB each</p>
      <PhotoButton onAdded={onAdded} className="mt-1" />
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

/**
 * Take a photo — a textbook page, a worksheet, the whiteboard, a leaf — or
 * pick one, and it becomes a material: read for its words and what it shows.
 * The phone offers the camera and the library itself.
 */
export function PhotoButton({ onAdded, className, label = 'Take or upload a photo' }: { onAdded: (material: Material) => void; className?: string; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  const calm = useCalmMotion()

  async function take(file: File) {
    setBusy(true)
    try {
      const material = await materialsApi.upload(file)
      onAdded(material)
      toast('Photo read', { tone: 'success', body: material.title })
    } catch (e) {
      toast("Couldn't read that photo", { tone: 'error', body: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className={cn('relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-mint-100 px-4 py-2 font-bold text-mint-700 transition-colors hover:bg-mint-100/80 disabled:cursor-wait dark:bg-mint-700/30 dark:text-mint-100', className)}
      >
        {busy && !calm && (
          // A scan line sweeping the button while the photo is looked at.
          <motion.span aria-hidden className="absolute inset-y-0 w-10 bg-white/50 blur-md" initial={{ x: '-150%' }} animate={{ x: '400%' }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }} />
        )}
        {busy ? <Spinner className="size-4" /> : <Camera weight="fill" className="size-5" aria-hidden />}
        <span className="relative">{busy ? 'Looking at your photo…' : label}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        aria-label="Choose a photo to make from"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void take(file)
          e.target.value = ''
        }}
      />
    </>
  )
}
