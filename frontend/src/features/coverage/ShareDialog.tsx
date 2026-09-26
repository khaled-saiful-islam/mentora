/**
 * Links to send home: one for the whole class — what has been covered, with
 * no names in it — and one per student, showing only that child's progress.
 * Every link can be stopped, and a stopped link shows nothing.
 */
import { Check, Copy, LinkBreak, LinkSimple, UsersThree } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Alert, Button } from '@/components/ui'
import { Dialog } from '@/components/ui/Dialog'
import { errorMessage } from '@/features/auth/errors'
import { classesApi, type Member } from '@/features/classes/api'
import { coverageApi, type ReportLink } from './api'

export function ShareDialog({ open, classId, onClose }: { open: boolean; classId: string; onClose: () => void }) {
  const [links, setLinks] = useState<ReportLink[] | null>(null)
  const [students, setStudents] = useState<Member[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    coverageApi.reports(classId).then((r) => setLinks(r.items)).catch((e) => setError(errorMessage(e)))
    classesApi.members(classId, { status: 'approved' }).then((r) => setStudents(r.items)).catch(() => setStudents([]))
  }, [open, classId])

  const linkFor = (studentId: string | null) => links?.find((l) => l.student_id === studentId) ?? null

  async function make(studentId: string | null) {
    setBusy(studentId ?? 'class')
    try {
      const made = await coverageApi.report(classId, studentId)
      setLinks((all) => [made, ...(all ?? [])])
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  async function stop(link: ReportLink) {
    setBusy(link.student_id ?? 'class')
    try {
      await coverageApi.revoke(classId, link.id)
      setLinks((all) => (all ?? []).filter((l) => l.id !== link.id))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Share with parents" description="Read-only links you can send home. Nobody needs an account to open them, and you can stop any link." size="lg">
      <div className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <section className="rounded-3xl border border-border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <UsersThree weight="duotone" className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold">The whole class</h3>
              <p className="text-sm text-muted-foreground">What has been covered so far and what is coming. No names, no one's scores.</p>
            </div>
          </div>
          <LinkRow link={linkFor(null)} busy={busy === 'class'} onMake={() => void make(null)} onStop={(l) => void stop(l)} />
        </section>

        <section>
          <h3 className="font-bold">One student</h3>
          <p className="text-sm text-muted-foreground">Their own progress on each topic — for their family only.</p>
          {students.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No students in this class yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-3xl border border-border">
              {students.map((student) => (
                <li key={student.student_id} className="px-4 py-3">
                  <p className="break-words font-semibold">{student.name}</p>
                  <LinkRow link={linkFor(student.student_id)} busy={busy === student.student_id} onMake={() => void make(student.student_id)} onStop={(l) => void stop(l)} compact />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  )
}

function LinkRow({
  link,
  busy,
  onMake,
  onStop,
  compact = false,
}: {
  link: ReportLink | null
  busy: boolean
  onMake: () => void
  onStop: (link: ReportLink) => void
  compact?: boolean
}) {
  const [copied, setCopied] = useState(false)
  if (!link) {
    return (
      <Button size="sm" variant={compact ? 'ghost' : 'primary'} className={compact ? 'mt-1 -ml-3' : 'mt-3'} onClick={onMake} loading={busy}>
        <LinkSimple weight="bold" className="size-4" aria-hidden /> Make a link
      </Button>
    )
  }
  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // No clipboard (an old browser, or not allowed): the link is on screen to copy by hand.
    }
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2 text-xs break-all">{link.url}</code>
      <Button size="sm" variant="outline" onClick={() => void copy(link.url)}>
        {copied ? <Check weight="bold" className="size-4" aria-hidden /> : <Copy weight="bold" className="size-4" aria-hidden />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onStop(link)} loading={busy}>
        <LinkBreak weight="bold" className="size-4" aria-hidden /> Stop
      </Button>
    </div>
  )
}
