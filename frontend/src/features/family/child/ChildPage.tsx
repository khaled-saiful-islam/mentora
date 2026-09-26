/**
 * One child, as their parent sees them (PLAN.md §20.3): who they are, how
 * their week is going, and six tabs of everything they do. Read-only, and
 * live — it changes as the child works.
 */
import { CaretLeft, ChalkboardTeacher, ChartLineUp, Barbell, CalendarStar, Fire, House, ListChecks, Medal, Warning } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useParams } from 'react-router-dom'
import { Alert, ButtonLink, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tabs } from '@/components/ui/Tabs'
import { Buddy } from '@/features/buddies'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { useResource } from '@/hooks/useResource'
import { useLive } from '@/lib/bus'
import { cn } from '@/lib/utils'
import { Page, pop, stagger } from '@/motion'
import { familyApi, type Child, type ChildOverview } from '../api'
import { isLate } from './bits'
import { ClassesTab } from './ClassesTab'
import { OverviewTab } from './OverviewTab'
import { PracticeTab } from './PracticeTab'
import { ResultsTab } from './ResultsTab'
import { ScheduleTab } from './ScheduleTab'
import { useChildResource } from './useChild'
import { WorkTab } from './WorkTab'

const TABS = ['overview', 'work', 'results', 'practice', 'schedule', 'classes'] as const
type TabKey = (typeof TABS)[number]

export default function ChildPage() {
  const { childId = '', tab } = useParams()
  const active: TabKey = TABS.includes(tab as TabKey) ? (tab as TabKey) : 'overview'
  const children = useResource('my-children', () => familyApi.children())
  useLive(['family'], () => void children.reload())
  const overview = useChildResource(childId, 'overview', () => familyApi.overview(childId))
  const child = children.data?.items.find((c) => c.id === childId)

  if (children.data && !child) {
    return (
      <Page className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
        <EmptyState
          art={<EmptyArt Icon={House} tone="from-kind-family-vivid/30 to-sun-100" />}
          title="You're not connected to this child"
          body="They may have been disconnected. Ask them for their family code to connect again."
          action={<ButtonLink to="/">Back home</ButtonLink>}
        />
      </Page>
    )
  }

  const late = overview.data?.todo.filter((t) => isLate(t)).length ?? 0
  const base = `/children/${childId}`
  const first = child?.first_name ?? 'your child'
  return (
    <Page className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      {(children.data?.items.length ?? 0) > 1 && (
        <ButtonLink to="/" variant="ghost" size="sm" className="-ml-3 mb-2">
          <CaretLeft weight="bold" className="size-4" aria-hidden /> All my children
        </ButtonLink>
      )}
      {child ? <Header child={child} overview={overview.data} late={late} /> : <Skeleton className="h-44 rounded-[2rem]" />}
      <Tabs
        className="mt-6"
        active={active}
        items={[
          { key: 'overview', label: 'Overview', to: base, icon: <House weight="bold" className="size-4" /> },
          { key: 'work', label: 'Work', to: `${base}/work`, badge: late, icon: <ListChecks weight="bold" className="size-4" /> },
          { key: 'results', label: 'Results', to: `${base}/results`, icon: <ChartLineUp weight="bold" className="size-4" /> },
          { key: 'practice', label: 'Practice', to: `${base}/practice`, icon: <Barbell weight="bold" className="size-4" /> },
          { key: 'schedule', label: 'Schedule', to: `${base}/schedule`, icon: <CalendarStar weight="bold" className="size-4" /> },
          { key: 'classes', label: 'Classes and teachers', to: `${base}/classes`, icon: <ChalkboardTeacher weight="bold" className="size-4" /> },
        ]}
      />
      {overview.error && <Alert className="mt-6">{overview.error}</Alert>}
      <div className="mt-6">
        {active === 'overview' && <OverviewTab childId={childId} first={first} overview={overview.data} />}
        {active === 'work' && <WorkTab childId={childId} first={first} />}
        {active === 'results' && <ResultsTab childId={childId} first={first} />}
        {active === 'practice' && <PracticeTab childId={childId} first={first} />}
        {active === 'schedule' && <ScheduleTab childId={childId} first={first} />}
        {active === 'classes' && <ClassesTab childId={childId} first={first} />}
      </div>
    </Page>
  )
}

function Header({ child, overview, late }: { child: Child; overview: ChildOverview | null; late: number }) {
  const waiting = overview?.todo.length ?? 0
  const streak = overview?.streak ?? 0
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-kind-family-vivid via-kind-family-vivid to-kind-family p-5 text-white shadow-lg md:p-6">
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="shrink-0 rounded-full bg-white/15 p-1 ring-1 ring-white/25">
          <Buddy buddy={child.buddy} size={96} mood="happy" bubble="top" />
        </div>
        <div className="min-w-[min(100%,14rem)] flex-1">
          <p className="text-sm font-bold opacity-85">You're their {child.label}</p>
          <h1 className="break-words font-display text-4xl font-semibold tracking-tight">{child.name}</h1>
          {child.grade_label && <p className="font-bold opacity-85">{child.grade_label}</p>}
        </div>
        <motion.ul className="flex flex-wrap gap-2" variants={stagger(0.08, 0.2)} initial="hidden" animate={overview ? 'shown' : 'hidden'}>
          <Stat Icon={Fire} text={streak > 0 ? `${streak}-day streak` : 'No streak yet'} />
          <Stat Icon={Medal} text={`${overview?.badges ?? 0} ${overview?.badges === 1 ? 'badge' : 'badges'}`} />
          <Stat Icon={ListChecks} text={waiting === 0 ? 'All caught up' : `${waiting} waiting`} />
          {late > 0 && <Stat Icon={Warning} text={`${late} past due`} alert />}
        </motion.ul>
      </div>
    </section>
  )
}

function Stat({ Icon, text, alert = false }: { Icon: typeof Fire; text: string; alert?: boolean }) {
  return (
    <motion.li variants={pop} className={cn('inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold', alert ? 'bg-white text-coral-700' : 'bg-white/15 ring-1 ring-white/25')}>
      <Icon weight="fill" className="size-4" aria-hidden />
      {text}
    </motion.li>
  )
}
