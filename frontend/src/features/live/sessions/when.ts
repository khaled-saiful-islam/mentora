/** Saying when a live lesson is, the way a person would. Pure, and tested. */

const DAY = 24 * 60 * 60 * 1000
// The Join button lights up this long before the start.
export const JOIN_EARLY_MS = 10 * 60 * 1000

export function whenLabel(iso: string, now: Date = new Date()): string {
  const at = new Date(iso)
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const days = dayDifference(at, now)
  if (days === 0) return `Today, ${time}`
  if (days === 1) return `Tomorrow, ${time}`
  const date = at.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  return `${date}, ${time}`
}

/** "in 2 days", "in 3 hours", "in 12 minutes", "now", or "" once long past. */
export function countdown(iso: string, now: Date = new Date()): string {
  const ms = new Date(iso).getTime() - now.getTime()
  if (ms <= 0) return ms > -2 * 60 * 60 * 1000 ? 'now' : ''
  const minutes = Math.ceil(ms / 60000)
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.round(ms / DAY)
  return `in ${days} day${days === 1 ? '' : 's'}`
}

export function joinOpen(iso: string | null, status: string, now: Date = new Date()): boolean {
  if (status === 'lobby' || status === 'live') return true
  if (status !== 'scheduled' || !iso) return false
  return new Date(iso).getTime() - now.getTime() <= JOIN_EARLY_MS
}

/** A `datetime-local` value for a Date, in the browser's zone. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function dayDifference(a: Date, b: Date): number {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((start(a) - start(b)) / DAY)
}
