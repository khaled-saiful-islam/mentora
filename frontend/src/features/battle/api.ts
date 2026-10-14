/**
 * Class Battle (§28.3.6): the room as the server shows it to each screen,
 * and what a teacher or a student can do in it.
 */
import { apiFetch } from '@/lib/api'
import { readSse } from '@/lib/sse'

export type BattleMode = 'tug' | 'boss'
export type BattlePhase = 'lobby' | 'question' | 'reveal' | 'done'
export type TeamKey = 'harimau' | 'kancil' | 'class'

export interface BattleTeam {
  key: TeamKey
  name: string
  icon: string
  members: { name: string; buddy: string | null }[]
}

export interface TeamSpirit {
  right: number
  comebacks: number
  /** How much better the team did in the second half, -1 to 1; null when too few answered. */
  improved: number | null
}

export interface BattleView {
  id: string
  title: string
  mode: BattleMode
  phase: BattlePhase
  version: number
  number: number
  total: number
  seconds_left: number
  teams: BattleTeam[]
  /** Negative: toward Team Harimau; positive: toward Team Kancil. */
  rope: number
  win: number
  hp: number
  max_hp: number
  answered: number
  players: number
  question: { ask: string; options: string[] } | null
  reveal: { answer: number; why: string } | null
  outcome: 'harimau' | 'kancil' | 'draw' | 'beaten' | 'escaped' | null
  spirit: { teams: Partial<Record<TeamKey, TeamSpirit>>; comeback_crew: string[] } | null
  /** A player's own: their team, and their answer to the question now. */
  you?: { team: TeamKey; choice: number | null }
}

const post = <T,>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) })

export const battleApi = {
  open: (classId: string, setId: string, mode: BattleMode) => post<BattleView>('/battles', { class_id: classId, set_id: setId, mode }),
  start: (id: string) => post<BattleView>(`/battles/${id}/start`),
  next: (id: string) => post<BattleView>(`/battles/${id}/next`),
  end: (id: string) => post<BattleView>(`/battles/${id}/end`),
  join: (id: string) => post<BattleView>(`/battles/${id}/join`),
  answer: (id: string, choice: number) => post<{ taken: boolean }>(`/battles/${id}/answer`, { choice }),
  mine: () => apiFetch<{ items: { id: string; title: string; mode: BattleMode; phase: BattlePhase }[] }>('/battles/mine'),
}

/** The room, now and after every change, until it ends or the signal aborts. */
export async function* battleViews(id: string, signal: AbortSignal): AsyncGenerator<BattleView> {
  const response = await fetch(`/api/battles/${id}/stream`, { signal })
  if (!response.ok || !response.body) throw new Error(response.status === 404 ? 'That battle is over.' : `The battle could not be reached (${response.status}).`)
  for await (const message of readSse(response.body, signal)) {
    try {
      yield JSON.parse(message.data) as BattleView
    } catch {
      // A keep-alive or a proxy's noise.
    }
  }
}
