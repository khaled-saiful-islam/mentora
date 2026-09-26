import type { FlashcardItem } from '../api'
import { GrowingText, SkillPicker, SourceToggles } from './fields'
import type { ItemEditorProps, KindEditor } from './types'

function FlashcardEditor({ item, skills, sources, onChange }: ItemEditorProps<FlashcardItem>) {
  const set = (patch: Partial<FlashcardItem>) => onChange({ ...item, ...patch })
  return (
    <div className="space-y-3">
      <div className="grid gap-3 @md:grid-cols-2">
        <div className="rounded-2xl border-2 border-kind-flashcard-vivid/40 bg-kind-flashcard-vivid/5 p-2">
          <p className="px-3 pt-1 text-xs font-bold uppercase tracking-wider text-kind-flashcard">Front</p>
          <GrowingText label="Front" value={item.front} maxLength={200} placeholder="A word or a question" onChange={(front) => set({ front })} className="font-display text-lg font-semibold" />
        </div>
        <div className="rounded-2xl border-2 border-sun-300 bg-sun-100/50 p-2 dark:bg-sun-600/10">
          <p className="px-3 pt-1 text-xs font-bold uppercase tracking-wider text-sun-600 dark:text-sun-300">Back</p>
          <GrowingText label="Back" value={item.back} maxLength={400} placeholder="What it means" onChange={(back) => set({ back })} />
        </div>
      </div>
      <GrowingText label="Hint" value={item.hint} maxLength={160} placeholder="A hint, if you like (optional)" onChange={(hint) => set({ hint })} className="text-sm text-muted-foreground" />
      <div className="flex flex-wrap items-center gap-2">
        <SkillPicker value={item.skill} skills={skills} onChange={(skill) => set({ skill })} />
      </div>
      <SourceToggles value={item.source_ids} sources={sources} onChange={(source_ids) => set({ source_ids })} />
    </div>
  )
}

export const flashcardEditor: KindEditor<FlashcardItem> = {
  Editor: FlashcardEditor,
  blank: (skill) => ({ id: '', front: '', back: '', hint: '', skill, source_ids: [] }),
  problem: (item) => (!item.front.trim() ? 'Write the front.' : !item.back.trim() ? 'Write the back.' : null),
}
