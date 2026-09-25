import { ApiError } from '@/lib/api'

/** What to tell someone when a form fails — the API's words when it has them. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Too many tries. Take a breath and try again in a minute.'
    return error.message
  }
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong. Please try again.'
}
