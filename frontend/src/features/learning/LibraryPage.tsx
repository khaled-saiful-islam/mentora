import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Archive, Books, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { Alert, Button, Input, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { errorMessage } from '@/features/auth/errors'
import { useResource } from '@/hooks/useResource'
import { useAuth } from '@/lib/auth'
import { Page, stagger } from '@/motion'
import { learningApi } from './api'
import { useLearnStudio } from './LearnStudio'
import { SetCard } from './SetCard'

type Filter = 'all' | 'quiz' | 'flashcard' | 'archived'

export default function LibraryPage() {
  const { user } = useAuth()
  const studio = useLearnStudio()
  const { toast } = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  const student = user?.role === 'student'

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const sets = useResource(`library:${filter}:${q}:${studio.watching}`, () =>
    learningApi.list({
      kind: filter === 'quiz' || filter === 'flashcard' ? filter : undefined,
      archived: filter === 'archived',
      q,
    }),
  )

  async function retry(id: string) {
    try {
      const set = await learningApi.retry(id)
      studio.watch(set)
      void sets.reload()
    } catch (error) {
      toast('Could not try again', { tone: 'error', body: errorMessage(error) })
    }
  }

  const items = sets.data?.items ?? []
  return (
    <Page className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="font-display text-4xl font-semibold tracking-tight">{student ? 'My practice' : 'Library'}</h1>
          <p className="mt-1 text-muted-foreground">
            {student ? 'Quizzes and flashcards you made for yourself.' : 'Every quiz and deck of flashcards you have made.'}
          </p>
        </div>
        <Button size="lg" onClick={() => studio.create()}>
          <Plus weight="bold" className="size-5" />
          Make one
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <MagnifyingGlass weight="bold" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search your sets" placeholder="Search by title or topic" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-11" />
        </div>
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'quiz', label: 'Quizzes' },
            { value: 'flashcard', label: 'Flashcards' },
            { value: 'archived', label: 'Archived', icon: <Archive weight="bold" className="size-4" /> },
          ]}
        />
      </div>

      {sets.error && <Alert className="mt-6">{sets.error}</Alert>}
      <div className="mt-6">
        {sets.loading && !sets.data ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 rounded-[1.5rem]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            art={<EmptyArt Icon={Books} tone="from-sun-100 to-grape-100" />}
            title={q ? 'Nothing matches that' : filter === 'archived' ? 'Nothing archived' : 'Your library is empty'}
            body={q || filter === 'archived' ? undefined : 'Make a quiz or a set of flashcards on any topic — it takes about a minute.'}
            action={!q && filter !== 'archived' && <Button size="lg" onClick={() => studio.create()}><Plus weight="bold" className="size-5" />Make your first</Button>}
          />
        ) : (
          <motion.ul key={`${filter}:${q}`} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" variants={stagger(0.05)} initial="hidden" animate="shown">
            {items.map((set) => (
              <SetCard key={set.id} set={set} onWatch={() => studio.watch(set)} onRetry={() => void retry(set.id)} />
            ))}
          </motion.ul>
        )}
      </div>
    </Page>
  )
}
