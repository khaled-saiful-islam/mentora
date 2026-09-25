/**
 * Making sets, from anywhere: the create sheet and the live generation panel,
 * held once for the whole app. A build keeps being followed with its panel
 * closed, so its owner hears when it is ready wherever they are.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import type { LearningKindName, SetSummary } from './api'
import { CreateSheet } from './CreateSheet'
import { GenerationPanel } from './GenerationPanel'
import { useGeneration } from './useGeneration'

interface StudioState {
  create: (kind?: LearningKindName) => void
  watch: (set: Pick<SetSummary, 'id' | 'kind' | 'title' | 'topic' | 'grade_label' | 'purpose'>) => void
  watching: string | null
}

const StudioContext = createContext<StudioState | null>(null)

type Watched = Pick<SetSummary, 'id' | 'kind' | 'title' | 'topic' | 'grade_label' | 'purpose'>

export function LearnStudioProvider({ children }: { children: React.ReactNode }) {
  const [sheetKind, setSheetKind] = useState<LearningKindName | null>(null)
  const [watched, setWatched] = useState<Watched | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const generation = useGeneration(watched?.id ?? null)
  const { toast } = useToast()
  const told = useRef<string | null>(null)

  const create = useCallback((kind?: LearningKindName) => setSheetKind(kind ?? 'quiz'), [])
  const watch = useCallback((set: Watched) => {
    setWatched(set)
    setPanelOpen(true)
    told.current = null
  }, [])

  // Finished with the panel closed: say so, once. Finished while it was open
  // counts as told — they watched it happen.
  useEffect(() => {
    const outcome = generation.outcome
    if (!watched || outcome.kind === 'running' || told.current === watched.id) return
    told.current = watched.id
    if (panelOpen) return
    if (outcome.kind === 'done') toast(`"${outcome.title}" is ready!`, { body: 'Open it from your library.' })
    else toast("That set couldn't be made", { tone: 'error', body: outcome.message })
  }, [generation.outcome, watched, panelOpen, toast])

  const value = useMemo(() => ({ create, watch, watching: watched?.id ?? null }), [create, watch, watched])
  return (
    <StudioContext.Provider value={value}>
      {children}
      <CreateSheet
        kind={sheetKind}
        onKind={setSheetKind}
        onClose={() => setSheetKind(null)}
        onStarted={(set) => {
          setSheetKind(null)
          watch(set)
        }}
      />
      {watched && (
        <GenerationPanel
          open={panelOpen}
          set={watched}
          generation={generation}
          onClose={() => setPanelOpen(false)}
          onAnother={() => {
            setPanelOpen(false)
            setSheetKind(watched.kind)
          }}
        />
      )}
    </StudioContext.Provider>
  )
}

export function useLearnStudio(): StudioState {
  const context = useContext(StudioContext)
  if (!context) throw new Error('useLearnStudio must be used inside <LearnStudioProvider>')
  return context
}
