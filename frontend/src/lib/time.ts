/** "just now", "5m", "3h", "2d", "12 Mar" — short enough for a list row. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const seconds = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d`
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const DAY_MS = 86_400_000

function dayNumber(date: Date): number {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / DAY_MS)
}

/** "Due today", "Due tomorrow", "Due in 3 days", "Due 12 Mar", or "Late"
 *  — in calendar days where the student is, not 24-hour blocks. */
export function dueLabel(iso: string, now: Date = new Date()): { text: string; late: boolean; soon: boolean } {
  const due = new Date(iso)
  if (due.getTime() < now.getTime()) return { text: 'Late — you can still do it', late: true, soon: false }
  const days = dayNumber(due) - dayNumber(now)
  if (days <= 0) return { text: 'Due today', late: false, soon: true }
  if (days === 1) return { text: 'Due tomorrow', late: false, soon: true }
  if (days < 7) return { text: `Due in ${days} days`, late: false, soon: false }
  return { text: `Due ${due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`, late: false, soon: false }
}
