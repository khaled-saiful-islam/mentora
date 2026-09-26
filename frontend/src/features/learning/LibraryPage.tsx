import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Archive, Books, FolderOpen, MagnifyingGlass, Plus, Stack } from '@phosphor-icons/react'
import { Alert, Button, Input, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { Tabs } from '@/components/ui/Tabs'
import { MaterialsView } from '@/features/materials/MaterialsView'
import { can } from '@/lib/user'
import { useToast } from '@/components/ui/Toast'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { errorMessage } from '@/features/auth/errors'
import { useResource } from '@/hooks/useResource'
import { useAuth } from '@/lib/auth'
import { Page, stagger } from '@/motion'
import { learningApi } from './api'
import { useLearnStudio } from './LearnStudio'
import { AddTile } from '@/components/ui/AddTile'
import { cn } from '@/lib/utils'
import { SetCard } from './SetCard'
import { SendHomeDialog } from '@/features/family/SendHomeDialog'
import type { SetSummary } from './api'

type Filter = 'all' | 'quiz' | 'flashcard' | 'study_guide' | 'archived'

export default function LibraryPage() {
  const { user } = useAuth()
  const studio = useLearnStudio()
  const { toast } = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  const student = user?.role === 'student'
  const parent = user?.role === 'parent'
  const [sending, setSending] = useState<SetSummary | null>(null)
  const [params] = useSearchParams()
  const keeps = can(user, 'keep_materials')
  const view = keeps && params.get('view') === 'materials' ? 'materials' : 'sets'

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const sets = useResource(`library:${filter}:${q}:${studio.watching}`, () =>
    learningApi.list({
      kind: filter === 'all' || filter === 'archived' ? undefined : filter,
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
  const adding = !q && filter !== 'archived'
  return (
    <Page className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="font-display text-4xl font-semibold tracking-tight">{student ? 'My practice' : 'Library'}</h1>
          <p className="mt-1 text-muted-foreground">
            {student
              ? 'Quizzes and flashcards you made for yourself.'
              : view === 'materials'
                ? parent
                  ? 'Your own files — worksheets, notes, pages from a book — to make quizzes and flashcards from.'
                  : 'Your own files, kept to make quizzes, flashcards, guides and live lessons from.'
                : parent
                  ? 'Quizzes, flashcards and study guides you made to send home to your child.'
                  : 'Every quiz, deck and study guide you have made.'}
          </p>
        </div>
        <Button size="lg" onClick={() => studio.create()}>
          <Plus weight="bold" className="size-5" />
          Make one
        </Button>
      </div>

      {keeps && (
        <Tabs
          className="mt-6"
          active={view}
          items={[
            { key: 'sets', label: 'What I made', to: '/library', icon: <Stack weight="bold" className="size-4" /> },
            { key: 'materials', label: 'My materials', to: '/library?view=materials', icon: <FolderOpen weight="bold" className="size-4" /> },
          ]}
        />
      )}

      {view === 'materials' ? (
        <div className="mt-6">
          <MaterialsView />
        </div>
      ) : (
        <>

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
            ...(student ? [] : [{ value: 'study_guide' as const, label: 'Study guides' }]),
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
          <motion.ul
            key={`${filter}:${q}`}
            // Three across only once there are three to show; one set and the
            // add tile share the row rather than leave a third of it empty.
            className={cn('grid gap-5 sm:grid-cols-2', items.length + (adding ? 1 : 0) >= 3 && 'lg:grid-cols-3')}
            variants={stagger(0.05)}
            initial="hidden"
            animate="shown"
          >
            {items.map((set) => (
              <SetCard key={set.id} set={set} onWatch={() => studio.watch(set)} onRetry={() => void retry(set.id)} onSend={parent ? () => setSending(set) : undefined} />
            ))}
            {adding && (
              <AddTile
                title={student ? 'Another practice set' : 'Make another'}
                hint={student ? 'Any topic you like — ready in a minute.' : 'A quiz, flashcards or a study guide.'}
                onClick={() => studio.create()}
                count={items.length}
                columns={items.length + 1 >= 3 ? { sm: 2, lg: 3 } : { sm: 2 }}
              />
            )}
          </motion.ul>
        )}
      </div>
        </>
      )}
      {sending && <SendHomeDialog open set={sending} onClose={() => setSending(null)} />}
    </Page>
  )
}
