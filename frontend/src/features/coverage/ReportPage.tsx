/**
 * The page a parent opens from a teacher's link: what the class has covered
 * this year, topic by topic, and — on a student's own link — how their child
 * is doing on each. Read-only, no account, and made to print on one or two
 * pages.
 *
 * Outside `Protected` on purpose: a parent has no account.
 */
import { CheckCircle, Printer, Sparkle } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Wordmark } from '@/brand/Logo'
import { Alert, Button, Spinner } from '@/components/ui'
import { cn } from '@/lib/utils'
import { rise, stagger } from '@/motion'
import { coverageApi, monthName, type PublicReport } from './api'
import { AREA_LOOKS, KIND_DOTS, TOPIC_LOOKS, scoreTone } from './looks'

export default function ReportPage() {
  const { token = '' } = useParams()
  const [report, setReport] = useState<PublicReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    coverageApi
      .public(token)
      .then((found) => !cancelled && setReport(found))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "This report link isn't working."))
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (report) document.title = `${report.student_name ?? report.class_name} · Progress · Mentora`
  }, [report])

  return (
    <main className="min-h-dvh bg-background px-4 py-8 print:bg-white print:py-0">
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Wordmark tile />
          {report && (
            <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
              <Printer weight="bold" className="size-4" aria-hidden /> Print
            </Button>
          )}
        </header>
        {error ? (
          <Alert className="mt-8">{error}</Alert>
        ) : !report ? (
          <div className="mt-16 grid place-items-center">
            <Spinner />
          </div>
        ) : (
          <Report report={report} />
        )}
      </div>
    </main>
  )
}

function Report({ report }: { report: PublicReport }) {
  const s = report.summary
  const child = report.student_name
  const made = new Date(report.made_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="shown">
      <motion.section variants={rise} className="mt-8 rounded-[2rem] bg-gradient-to-br from-grape-600 to-grape-800 p-6 text-white shadow-lg print:shadow-none md:p-8">
        <p className="text-sm font-bold opacity-85">{[report.subject, report.grade_label].filter(Boolean).join(' · ')}</p>
        <h1 className="mt-1 break-words font-display text-3xl font-semibold md:text-4xl">{child ? `${child}'s progress` : `What ${report.class_name} has covered`}</h1>
        <p className="mt-1 opacity-90">
          {report.class_name} with {report.teacher_name} · as of {made}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Big value={`${s.taught} of ${s.topics}`} label="topics taught" />
          <Big value={String(s.secure)} label={child ? 'topics secure' : 'topics the class has secured'} />
          {s.mastery !== null && <Big value={`${Math.round(s.mastery)}%`} label={child ? `${child}'s average` : 'class average'} />}
        </div>
      </motion.section>

      <motion.p variants={rise} className="mt-6 text-muted-foreground">
        {child
          ? `Each topic below shows what the class learned and how ${child} did in the quizzes on it. A topic marked "needs work" is a good one to talk about at home.`
          : 'Each topic below shows what the class has learned so far, and when.'}
      </motion.p>

      <div className="mt-6 space-y-4">
        {report.areas.map((area) => (
          <Area key={area.title} area={area} />
        ))}
      </div>

      <motion.p variants={rise} className="mt-8 flex items-center gap-2 text-sm text-muted-foreground print:mt-4">
        <Sparkle weight="fill" className="size-4 text-star" aria-hidden />
        Made with Mentora. This page is private to you — please don't share the link.
      </motion.p>
    </motion.div>
  )
}

function Big({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/15 px-4 py-3 ring-1 ring-white/25">
      <p className="font-display text-2xl font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-sm font-bold opacity-85">{label}</p>
    </div>
  )
}

function Area({ area }: { area: PublicReport['areas'][number] }) {
  const look = AREA_LOOKS[area.status]
  return (
    <motion.section variants={rise} className="break-inside-avoid rounded-3xl border border-border bg-surface p-5 shadow-sm print:shadow-none">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 break-words font-display text-xl font-semibold">{area.title}</h2>
        <span className={cn('rounded-full px-3 py-1 text-xs font-bold', look.pill)}>{look.label}</span>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {area.topics.map((topic) => {
          const status = TOPIC_LOOKS[topic.status]
          return (
            <li key={topic.title} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3">
              <div className="min-w-[12rem] flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  {topic.status === 'secure' && <CheckCircle weight="fill" className="size-4 shrink-0 text-correct" aria-hidden />}
                  <span className="break-words">{topic.title}</span>
                </p>
                {topic.items.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {topic.items.map((item, i) => (
                      <li key={`${item.title}-${i}`} className="inline-flex items-center gap-1.5">
                        <span className={cn('size-2 rounded-full', KIND_DOTS[item.kind].dot)} aria-hidden />
                        {item.title} · {monthName(item.month)}
                        {item.planned && ' (coming up)'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', status.pill)}>{status.label}</span>
                {topic.mastery !== null && (
                  <span className="flex w-28 items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className={cn('block h-full rounded-full', scoreTone(topic.mastery))} style={{ width: `${topic.mastery}%` }} />
                    </span>
                    <span className="text-xs font-bold tabular-nums">{Math.round(topic.mastery)}%</span>
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </motion.section>
  )
}
