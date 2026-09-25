import { Link } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { AppearanceCard } from '@/features/settings/AppearanceCard'
import { MemoryCard } from '@/features/settings/MemoryCard'
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

      <AppearanceCard />

      {can(user, 'use_chat') && <MemoryCard />}
    </main>
  )
}
