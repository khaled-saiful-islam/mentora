import { useState } from 'react'
import { MagicWand } from '@phosphor-icons/react'
import { Button, Input } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { learningApi, type Item } from './api'
import { nounOf } from './kinds'

const EXAMPLES: Record<string, string> = {
  quiz: 'e.g. a harder question about roots',
  flashcard: 'e.g. a card for "chlorophyll"',
  study_guide: 'e.g. a part on why the sky is blue',
}

/**
 * "Write me one more about…" — a new item from AI, placed at the end for the
 * teacher to read before saving. Nothing is saved until they do.
 */
export function AddWithAI({ setId, kind, disabled, onAdded }: { setId: string; kind: string; disabled?: boolean; onAdded: (item: Item) => void }) {
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  const noun = nounOf(kind)

  async function write(event: React.FormEvent) {
    event.preventDefault()
    if (instruction.trim().length < 2) return
    setBusy(true)
    try {
      const { item } = await learningApi.add(setId, instruction.trim())
      onAdded(item)
      setInstruction('')
      toast(`New ${noun} added — save to keep it`)
    } catch (error) {
      toast(`Could not write that ${noun}`, { tone: 'error', body: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={write} className="flex flex-col gap-2 rounded-[1.5rem] border-2 border-dashed border-grape-200 bg-grape-50/50 p-3 sm:flex-row sm:items-center dark:border-grape-700 dark:bg-grape-900/20">
      <MagicWand weight="duotone" className="hidden size-6 shrink-0 text-primary sm:block" aria-hidden />
      <Input
        aria-label={`Ask AI for a new ${noun}`}
        placeholder={EXAMPLES[kind] ?? `What should the new ${noun} be about?`}
        value={instruction}
        maxLength={300}
        disabled={disabled || busy}
        onChange={(e) => setInstruction(e.target.value)}
        className="h-11"
      />
      <Button type="submit" loading={busy} disabled={disabled || instruction.trim().length < 2} className="shrink-0">
        {!busy && <MagicWand weight="bold" className="size-4" />} Write it with AI
      </Button>
    </form>
  )
}
