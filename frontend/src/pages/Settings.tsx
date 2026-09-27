import { Link } from 'react-router-dom'
import { ArrowLeft, MapTrifold } from '@phosphor-icons/react'
import { Button, Card } from '@/components/ui'
import { ChildrenCard } from '@/features/family/ChildrenCard'
import { FamilyCard } from '@/features/family/FamilyCard'
import { AppearanceCard } from '@/features/settings/AppearanceCard'
import { MemoryCard } from '@/features/settings/MemoryCard'
import { openTour } from '@/features/onboarding/Tour'
import { tourFor } from '@/features/onboarding/tours'
import { useAuth } from '@/lib/auth'
import { can } from '@/lib/user'

export default function Settings() {
  const { user } = useAuth()

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6 md:py-10">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft weight="bold" className="size-4" aria-hidden />
        Back home
      </Link>

      <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>

      {can(user, 'invite_family') && <FamilyCard />}
      {can(user, 'see_children') && <ChildrenCard />}

      <AppearanceCard />

      {can(user, 'use_chat') && <MemoryCard />}

      {tourFor(user).length > 0 && (
        <Card className="mt-8 flex flex-wrap items-center gap-4 p-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-grape-100 text-grape-600 dark:bg-grape-800/40 dark:text-grape-200" aria-hidden>
            <MapTrifold weight="duotone" className="size-7" />
          </span>
          <div className="min-w-[12rem] flex-1">
            <h2 className="font-display text-lg font-semibold">The tour</h2>
            <p className="text-sm text-muted-foreground">A quick look at what you can do here.</p>
          </div>
          <Button variant="outline" onClick={openTour}>
            Show me around
          </Button>
        </Card>
      )}
    </main>
  )
}
