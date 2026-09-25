/**
 * Follow a set being made. The stream replays from the first event, so
 * opening this after a reload — or from the library, later — rebuilds the
 * whole picture, not just the tail of it.
 */
import { useEffect, useReducer } from 'react'
import type { Item, Skill } from './api'

export type StageKey = 'check' | 'research' | 'skills' | 'write'

export interface StageState {
  key: StageKey
  state: 'running' | 'done'
  label: string
  detail: string
}

export interface SourceChip {
  id: string
  title: string
  host: string
  url: string
}

export interface Generation {
  stages: Partial<Record<StageKey, StageState>>
  sources: SourceChip[]
  skills: Skill[]
  items: Item[]
  outcome:
    | { kind: 'running' }
    | { kind: 'done'; title: string; count: number; requested: number; grounded: boolean }
    | { kind: 'failed' | 'refused'; message: string }
}

export const STAGE_ORDER: StageKey[] = ['check', 'research', 'skills', 'write']

const INITIAL: Generation = { stages: {}, sources: [], skills: [], items: [], outcome: { kind: 'running' } }

type Action = { type: string; data: Record<string, unknown> } | { type: 'reset' }

export function reduce(state: Generation, action: Action): Generation {
  if (action.type === 'reset') return INITIAL
  const data = 'data' in action ? action.data : {}
  switch (action.type) {
    case 'stage': {
      const stage = data as unknown as StageState
      return { ...state, stages: { ...state.stages, [stage.key]: stage } }
    }
    case 'sources':
      return { ...state, sources: (data.sources as SourceChip[]) ?? [] }
    case 'skills':
      return { ...state, skills: (data.skills as Skill[]) ?? [] }
    case 'items':
      return { ...state, items: [...state.items, ...((data.items as Item[]) ?? [])] }
    case 'done':
      return {
        ...state,
        outcome: {
          kind: 'done',
          title: String(data.title ?? ''),
          count: Number(data.count ?? state.items.length),
          requested: Number(data.requested ?? data.count ?? 0),
          grounded: data.grounded !== false,
        },
      }
    case 'failed':
    case 'refused':
      return { ...state, outcome: { kind: action.type, message: String(data.message ?? 'This set could not be made.') } }
    default:
      return state
  }
}

const EVENTS = ['stage', 'sources', 'skills', 'items', 'done', 'failed', 'refused'] as const

export function useGeneration(setId: string | null): Generation {
  const [state, dispatch] = useReducer(reduce, INITIAL)

  useEffect(() => {
    dispatch({ type: 'reset' })
    if (!setId || typeof EventSource === 'undefined') return
    const source = new EventSource(`/api/learning-sets/${setId}/stream`)
    const handlers = EVENTS.map((type) => {
      const handler = (event: MessageEvent<string>) => {
        try {
          dispatch({ type, data: JSON.parse(event.data) as Record<string, unknown> })
        } catch {
          // A garbled frame is skipped; the next one carries on.
        }
        if (type === 'done' || type === 'failed' || type === 'refused') source.close()
      }
      source.addEventListener(type, handler as EventListener)
      return [type, handler] as const
    })
    return () => {
      handlers.forEach(([type, handler]) => source.removeEventListener(type, handler as EventListener))
      source.close()
    }
  }, [setId])

  return state
}
