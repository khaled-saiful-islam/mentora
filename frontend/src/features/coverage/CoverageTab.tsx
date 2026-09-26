/**
 * A class's coverage: how much of the year's syllabus has been taught, the
 * map of it month by month, what to teach next, and links to send home.
 */
import { MapTrifold, PencilSimple, ShareNetwork, Sparkle } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Alert, Button, Card, Skeleton } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { useResource } from '@/hooks/useResource'
import { cn } from '@/lib/utils'
import { pop, rise, stagger, useCalmMotion } from '@/motion'
import { coverageApi, type Coverage, type PlanStep, type SyllabusArea } from './api'
import { KIND_DOTS, TOPIC_LOOKS } from './looks'
import { Matrix } from './Matrix'
import { PlanPanel } from './PlanPanel'
import { ShareDialog } from './ShareDialog'
import { SyllabusEditor } from './SyllabusEditor'

export function CoverageTab({ classId, subject }: { classId: string; subject: string | null }) {
  const coverage = useResource(`coverage:${classId}`, () => coverageApi.get(classId))
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [plan, setPlan] = useState<{ busy: boolean; steps: PlanStep[] | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const data = coverage.data

  async function draft() {
    setDrafting(true)
    setError(null)
    try {
      await coverageApi.draft(classId)
      await coverage.reload()
      toast('Your syllabus is ready', { body: 'Check it over — every area and topic is yours to change.' })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setDrafting(false)
    }
  }

  async function save(areas: SyllabusArea[]) {
    await coverageApi.save(classId, areas)
    await coverage.reload()
    toast('Syllabus saved')
  }

  async function planRest() {
    setPlan({ busy: true, steps: null })
    try {
      setPlan({ busy: false, steps: (await coverageApi.plan(classId)).steps })
    } catch (e) {
      setPlan(null)
      setError(errorMessage(e))
    }
  }

  if (coverage.error) return <Alert>{coverage.error}</Alert>
  if (!data) return <Skeleton className="h-96 rounded-3xl" />

  const hasSyllabus = data.syllabus.areas.length > 0
  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {!hasSyllabus ? (
        <Start drafting={drafting} onDraft={() => void draft()} onWrite={() => setEditing(true)} />
      ) : (
        <>
          <Header data={data} onPlan={() => void planRest()} onEdit={() => setEditing(true)} onShare={() => setSharing(true)} planning={plan?.busy ?? false} />
          {plan && <PlanPanel steps={plan.steps} busy={plan.busy} classId={classId} subject={subject} onClose={() => setPlan(null)} />}
          <Legend />
          <Matrix areas={data.areas} months={data.months} now={data.now} />
          <Aside data={data} />
        </>
      )}
      <SyllabusEditor open={editing} initial={data.syllabus.areas} onClose={() => setEditing(false)} onSave={save} />
      <ShareDialog open={sharing} classId={classId} onClose={() => setSharing(false)} />
    </div>
  )
}

function Start({ drafting, onDraft, onWrite }: { drafting: boolean; onDraft: () => void; onWrite: () => void }) {
  const calm = useCalmMotion()
  return (
    <Card className="relative overflow-hidden p-8 text-center">
      <span className="blob -left-10 -top-16 size-56 bg-sky-100" aria-hidden />
      <span className="blob -bottom-20 right-0 size-56 bg-grape-100" aria-hidden />
      <div className="relative mx-auto max-w-lg">
        <motion.span
          className="mx-auto grid size-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-press"
          animate={calm ? undefined : { rotate: [0, -6, 6, 0], y: [0, -4, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <MapTrifold weight="duotone" className="size-9" aria-hidden />
        </motion.span>
        <h2 className="mt-4 font-display text-2xl font-semibold">Map the year</h2>
        <p className="mt-2 text-muted-foreground">
          Start with the year's syllabus. Everything you share and teach live is then placed on it by itself, so you can see what's covered, what's left, and how the class is doing — and send it home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button size="lg" onClick={onDraft} loading={drafting}>
            {!drafting && <Sparkle weight="fill" className="size-5" aria-hidden />}
            {drafting ? 'Drafting from the curriculum…' : 'Draft it for me'}
          </Button>
          <Button size="lg" variant="outline" onClick={onWrite} disabled={drafting}>
            <PencilSimple weight="bold" className="size-5" aria-hidden /> Write my own
          </Button>
        </div>
      </div>
    </Card>
  )
}

function Header({ data, onPlan, onEdit, onShare, planning }: { data: Coverage; onPlan: () => void; onEdit: () => void; onShare: () => void; planning: boolean }) {
  const s = data.summary
  const share = s.topics ? s.taught / s.topics : 0
  return (
    <Card className="flex flex-wrap items-center gap-5 p-5">
      <Ring share={share} />
      <div className="min-w-[12rem] flex-1">
        <h2 className="font-display text-2xl font-semibold">
          {s.taught} of {s.topics} topics taught
        </h2>
        <motion.div className="mt-2 flex flex-wrap gap-2 text-sm font-bold" variants={stagger(0.05)} initial="hidden" animate="shown">
          <Chip tone={TOPIC_LOOKS.secure.pill}>{s.secure} secure</Chip>
          {s.needs_work > 0 && <Chip tone={TOPIC_LOOKS.needs_work.pill}>{s.needs_work} need work</Chip>}
          <Chip tone="bg-muted text-foreground">{s.mastery === null ? 'No scores yet' : `Class score ${Math.round(s.mastery)}%`}</Chip>
          <Chip tone="bg-muted text-foreground">{s.items} {s.items === 1 ? 'thing' : 'things'} taught</Chip>
          {s.planned > 0 && <Chip tone={TOPIC_LOOKS.planned.pill}>{s.planned} live coming up</Chip>}
        </motion.div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onPlan} loading={planning}>
          {!planning && <Sparkle weight="fill" className="size-4" aria-hidden />}
          Plan the rest
        </Button>
        <Button variant="outline" onClick={onShare}>
          <ShareNetwork weight="bold" className="size-4" aria-hidden /> Share with parents
        </Button>
        <Button variant="ghost" onClick={onEdit}>
          <PencilSimple weight="bold" className="size-4" aria-hidden /> Edit syllabus
        </Button>
      </div>
    </Card>
  )
}

function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <motion.span variants={pop} className={cn('rounded-full px-3 py-1', tone)}>
      {children}
    </motion.span>
  )
}

const RADIUS = 30
const CIRCLE = 2 * Math.PI * RADIUS

function Ring({ share }: { share: number }) {
  return (
    <span className="relative grid size-20 shrink-0 place-items-center">
      <svg viewBox="0 0 72 72" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="36" cy="36" r={RADIUS} fill="none" strokeWidth="8" className="stroke-muted" />
        <motion.circle
          cx="36"
          cy="36"
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCLE}
          initial={{ strokeDashoffset: CIRCLE }}
          animate={{ strokeDashoffset: CIRCLE * (1 - share) }}
          transition={{ type: 'spring', stiffness: 50, damping: 16 }}
          className="stroke-primary"
        />
      </svg>
      <span className="font-display text-lg font-semibold tabular-nums">{Math.round(share * 100)}%</span>
    </span>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-muted-foreground">
      {Object.values(KIND_DOTS).map((kind) => (
        <span key={kind.label} className="inline-flex items-center gap-1.5">
          <span className={cn('size-3 rounded-full', kind.dot)} aria-hidden /> {kind.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-full border-2 border-kind-live-vivid" aria-hidden /> Coming up
      </span>
    </div>
  )
}

/** What was taught but sits outside the syllabus, and what is still being placed. */
function Aside({ data }: { data: Coverage }) {
  const extra = [...data.outside, ...data.unsorted]
  if (extra.length === 0) return null
  return (
    <motion.section variants={rise} initial="hidden" animate="shown" className="rounded-3xl border-2 border-dashed border-border p-5">
      <h3 className="font-display text-lg font-semibold">Also taught</h3>
      <p className="text-sm text-muted-foreground">
        {data.unsorted.length > 0 ? 'Some of this is still being placed on the syllabus. ' : ''}These don't sit under a topic — edit the syllabus to give them a home.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {extra.map((item) => (
          <li key={`${item.source}-${item.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-semibold">
            <span className={cn('size-2.5 rounded-full', KIND_DOTS[item.kind].dot)} aria-hidden />
            {item.title}
          </li>
        ))}
      </ul>
    </motion.section>
  )
}
