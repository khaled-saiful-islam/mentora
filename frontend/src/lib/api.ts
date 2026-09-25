/**
 * The single door to the API.
 *
 * Every response the backend sends on failure has the shape
 * `{ error: { code, message } }`, so unwrapping happens once here rather than
 * at every call site.
 */

import type { LearningKindInfo } from '@/features/learning/api'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = 'error',
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type ErrorEnvelope = { error?: { code?: string; message?: string } }

async function toApiError(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status})`
  let code = 'error'
  try {
    const body = (await response.json()) as ErrorEnvelope
    if (body?.error?.message) message = body.error.message
    if (body?.error?.code) code = body.error.code
  } catch {
    // Non-JSON error bodies (a proxy 502, say) keep the generic message.
  }
  return new ApiError(message, response.status, code)
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      // Only for a JSON body. FormData must set its own content type, because
      // the boundary is generated per request — overriding it makes the server
      // unable to parse a multipart upload at all.
      ...(isJsonBody(init.body) ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** A string body is JSON here; FormData, Blob and friends are not. */
function isJsonBody(body: BodyInit | null | undefined): boolean {
  return typeof body === 'string'
}

export interface PublicConfig {
  app_name: string
  model: string
  search_enabled: boolean
  /** Whether a vision model is configured, so images may be uploaded. */
  images_enabled: boolean
  currency: string
  supported_languages: string[]
  /** The school levels, in picker order. */
  grades: Grade[]
}

export interface Grade {
  code: string
  label: string
  stage: string
}

export interface MakeableKind {
  name: string
  label: string
  description: string
}

export interface Makeable {
  studio: MakeableKind[]
  learning: LearningKindInfo[]
  /** Whether web search is configured, so sets can be grounded in sources. */
  grounded: boolean
}

/** What this person may make. Depends on who is asking, so not in /config. */
export const getMakeable = () => apiFetch<Makeable>('/me/makeable')

export const getConfig = () => apiFetch<PublicConfig>('/config')

export interface Health {
  status: 'ok' | 'degraded'
  app: string
  database: 'ok' | 'unreachable'
}

export const getHealth = () => apiFetch<Health>('/health')
