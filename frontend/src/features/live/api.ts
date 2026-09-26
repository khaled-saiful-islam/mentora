import { apiFetch, ApiError } from '@/lib/api'
import { readSse } from '@/lib/sse'

export type Pause = 'short' | 'breath' | 'think'

export interface Beat {
  id: string
  say: string
  show: string | null
  pause: Pause
  /** Recorded one by one, with a gentle gap after each. */
  sentences: string[]
}

export interface StudentLines {
  call: string
  thanks: string
  redirect: string
}

export interface Lesson {
  title: string
  beats: Beat[]
  recap: string
  seconds: number
  problems: string[]
  lines: Record<string, StudentLines>
}

export interface VoiceOffer {
  voices: string[]
  /** What each voice sounds like, e.g. "Warm female voice". */
  labels: Record<string, string>
  models: string[]
  voice: string
  model: string
  speed: number
  min_speed: number
  max_speed: number
}

export interface VoiceChoice {
  voice: string
  model: string
  speed: number
}

export type AnswerEvent =
  | { type: 'sentence'; text: string; last?: boolean }
  | { type: 'redirect'; text: string }
  | { type: 'done' }

export const getVoices = () => apiFetch<VoiceOffer>('/live/voices')

export const writeLesson = (body: { topic: string; grade_level: string | null; students: string[] }) =>
  apiFetch<Lesson>('/live/voice-lab/lesson', { method: 'POST', body: JSON.stringify(body) })

export const warmTutor = (body: { topic: string; grade_level: string | null; taught: string[] }) =>
  apiFetch<void>('/live/voice-lab/warm', { method: 'POST', body: JSON.stringify(body) })

/** One clip of the tutor's voice, as bytes ready to decode. */
export async function speak(text: string, choice: VoiceChoice, signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch('/api/live/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ...choice }),
    signal,
  })
  if (!response.ok) throw new ApiError('The voice could not say that.', response.status)
  return response.arrayBuffer()
}

/** The tutor's answer to a raised hand, one sentence at a time. */
export async function* askTutor(
  body: { question: string; student: string; topic: string; grade_level: string | null; taught: string[] },
  signal?: AbortSignal,
): AsyncGenerator<AnswerEvent> {
  const response = await fetch('/api/live/voice-lab/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok || !response.body) throw new ApiError('The tutor could not answer just now.', response.status)
  for await (const message of readSse(response.body, signal)) {
    try {
      yield JSON.parse(message.data) as AnswerEvent
    } catch {
      // A frame that is not JSON is a keep-alive or a proxy's noise.
    }
  }
}
