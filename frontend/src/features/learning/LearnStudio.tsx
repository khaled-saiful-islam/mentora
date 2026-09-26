/**
 * Making sets, from anywhere: the create sheet and the live generation panel,
 * held once for the whole app. A build carries on with its panel closed; the
 * work tray beside the bell shows how far along it is, and the bell says
 * when it is ready (`features/work`).
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { LearningKindName, SetSummary } from './api'
import { CreateSheet } from './CreateSheet'
import { GenerationPanel } from './GenerationPanel'
import { useGeneration } from './useGeneration'

interface StudioState {
  /** Open the maker, on a kind — and a topic to start from, if there is one. */
  create: (kind?: LearningKindName, topic?: string) => void
  watch: (set: Pick<SetSummary, 'id' | 'kind' | 'title' | 'topic' | 'grade_label' | 'purpose'>) => void
  watching: string | null
}

const StudioContext = createContext<StudioState | null>(null)

type Watched = Pick<SetSummary, 'id' | 'kind' | 'title' | 'topic' | 'grade_label' | 'purpose'>

export function LearnStudioProvider({ children }: { children: React.ReactNode }) {
  const [sheetKind, setSheetKind] = useState<LearningKindName | null>(null)
  const [sheetTopic, setSheetTopic] = useState('')
  const [watched, setWatched] = useState<Watched | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const generation = useGeneration(watched?.id ?? null)

  const create = useCallback((kind?: LearningKindName, topic?: string) => {
    setSheetTopic(topic ?? '')
    setSheetKind(kind ?? 'quiz')
  }, [])
  const watch = useCallback((set: Watched) => {
    setWatched(set)
    setPanelOpen(true)
  }, [])

  const value = useMemo(() => ({ create, watch, watching: watched?.id ?? null }), [create, watch, watched])
  return (
    <StudioContext.Provider value={value}>
      {children}
      <CreateSheet
        kind={sheetKind}
        initialTopic={sheetTopic}
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
