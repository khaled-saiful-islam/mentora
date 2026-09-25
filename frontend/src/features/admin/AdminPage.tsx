/**
 * The admin console: how the school is doing, the people in it, what the
 * safety checks caught, and everything that has been made.
 */
import { ChartLineUp, FolderOpen, ShieldCheck, UsersThree } from '@phosphor-icons/react'
import { useParams } from 'react-router-dom'
import { Tabs } from '@/components/ui/Tabs'
import { useResource } from '@/hooks/useResource'
import { Page } from '@/motion'
import { adminApi } from './api'
import { ContentTab } from './ContentTab'
import { OverviewTab } from './OverviewTab'
import { SafetyTab } from './SafetyTab'
import { UsersTab } from './UsersTab'

const TABS = ['overview', 'users', 'safety', 'content'] as const
type Tab = (typeof TABS)[number]

export default function AdminPage() {
  const { tab = 'overview' } = useParams()
  const active: Tab = (TABS as readonly string[]).includes(tab) ? (tab as Tab) : 'overview'
  const overview = useResource('admin-overview', () => adminApi.overview())
  const open = overview.data?.safety.open ?? 0

  return (
    <Page className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-1 text-muted-foreground">Keep the school running, and keep it safe.</p>
      <Tabs
        className="mt-6"
        active={active}
        items={[
          { key: 'overview', label: 'Overview', to: '/admin', icon: <ChartLineUp weight="bold" className="size-4" /> },
          { key: 'users', label: 'People', to: '/admin/users', icon: <UsersThree weight="bold" className="size-4" /> },
          { key: 'safety', label: 'Safety', to: '/admin/safety', badge: open || undefined, icon: <ShieldCheck weight="bold" className="size-4" /> },
          { key: 'content', label: 'Content', to: '/admin/content', icon: <FolderOpen weight="bold" className="size-4" /> },
        ]}
      />
      <div className="mt-6">
        {active === 'overview' && <OverviewTab overview={overview} />}
        {active === 'users' && <UsersTab />}
        {active === 'safety' && <SafetyTab onChange={() => void overview.reload()} />}
        {active === 'content' && <ContentTab />}
      </div>
    </Page>
  )
}
