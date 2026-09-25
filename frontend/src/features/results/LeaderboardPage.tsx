/**
 * A quiz's leaderboard: the top three on a podium with their buddies, the
 * rest in rows that slide into their new places when someone finishes.
 * Live — a push from the server reloads it — and first tries only, so a
 * retake can improve a score but not a place.
 */
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { CaretLeft, Crown, Lock, Ranking } from '@phosphor-icons/react'
import { useParams } from 'react-router-dom'
import { Alert, ButtonLink, Chip, Skeleton } from '@/components/ui'
import { LiveBadge } from '@/components/ui/LiveBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Buddy, BuddyAvatar } from '@/features/buddies'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { playApi, type Board, type BoardEntry } from '@/features/play/api'
import { useResource } from '@/hooks/useResource'
import { useAuth } from '@/lib/auth'
import { useLive } from '@/lib/bus'
import { cn } from '@/lib/utils'
import { Page, spring } from '@/motion'

// Left to right on the podium: second, first, third.
const PODIUM_ORDER = [1, 0, 2]
const STEP: Record<number, { height: string; tone: string; label: string }> = {
  1: { height: 'h-32', tone: 'from-sun-300 to-sun-600', label: '1st' },
  2: { height: 'h-24', tone: 'from-muted to-muted-foreground/60', label: '2nd' },
  3: { height: 'h-16', tone: 'from-kind-quiz-vivid to-kind-quiz', label: '3rd' },
}

export default function LeaderboardPage() {
  const { assignmentId = '' } = useParams()
  const { user } = useAuth()
  const board = useResource(`board-${assignmentId}`, () => playApi.leaderboard(assignmentId))
  useLive(['leaderboard'], (m) => m.assignment_id === assignmentId && void board.reload())
  const back = user?.role === 'student' ? '/' : `/assignments/${assignmentId}`

  return (
    <Page className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <ButtonLink to={back} variant="ghost" size="sm" className="-ml-3">
        <CaretLeft weight="bold" className="size-4" />
        Back
      </ButtonLink>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-sun-400 text-grape-900">
          <Ranking weight="fill" className="size-7" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">First tries only · ties share a place</p>
        </div>
        <LiveBadge className="ml-auto" />
        {board.data?.final && (
          <Chip tone="grape" className="text-sm">
            <Lock weight="bold" className="size-3.5" />
            Final — medals awarded
          </Chip>
        )}
      </div>

      {board.error && <Alert className="mt-6">{board.error}</Alert>}
      {!board.data ? (
        <Skeleton className="mt-8 h-72 rounded-[2rem]" />
      ) : !board.data.enabled ? (
        <EmptyState className="mt-8" art={<EmptyArt Icon={Ranking} />} title="No leaderboard here" body="This one was shared without a leaderboard." />
      ) : board.data.entries.length === 0 ? (
        <EmptyState className="mt-8" art={<EmptyArt Icon={Crown} tone="from-sun-100 to-grape-100" />} title="Be the first!" body="Nobody has finished yet. The top spot is waiting." />
      ) : (
        <Standings board={board.data} />
      )}
    </Page>
  )
}

function Standings({ board }: { board: Board }) {
  const podium = board.entries.filter((e) => e.rank <= 3).slice(0, 3)
  const rows = board.entries.filter((e) => !podium.includes(e))
  const youShown = board.entries.some((e) => e.you)
  return (
    <LayoutGroup>
      <Podium entries={podium} />
      <motion.ol layout className="mt-6 space-y-2">
        <AnimatePresence initial={false}>
          {rows.map((entry) => (
            <Row key={entry.student_id} entry={entry} />
          ))}
        </AnimatePresence>
      </motion.ol>
      {!youShown && board.you && (
        <div className="mt-4 border-t-2 border-dashed border-border pt-4">
          <Row entry={board.you} />
        </div>
      )}
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {board.total} {board.total === 1 ? 'person has' : 'people have'} finished
      </p>
    </LayoutGroup>
  )
}

function Podium({ entries }: { entries: BoardEntry[] }) {
  return (
    <div className="mt-8 grid grid-cols-3 items-end gap-2 rounded-[2rem] bg-gradient-to-b from-grape-100/60 to-transparent px-2 pt-6 sm:gap-4 sm:px-6 dark:from-grape-800/30">
      {PODIUM_ORDER.map((slot) => {
        const entry = entries[slot]
        if (!entry) return <div key={slot} />
        const step = STEP[entry.rank] ?? STEP[3]
        return (
          <motion.div
            key={entry.student_id}
            layoutId={entry.student_id}
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.bouncy, delay: 0.2 + slot * 0.15 }}
          >
            {entry.rank === 1 && (
              <motion.span animate={{ y: [0, -5, 0], rotate: [-6, 6, -6] }} transition={{ duration: 2.4, repeat: Infinity }}>
                <Crown weight="fill" className="size-8 text-star drop-shadow" />
              </motion.span>
            )}
            <Buddy buddy={entry.buddy} size={entry.rank === 1 ? 104 : 84} mood={entry.rank === 1 ? 'dance' : 'happy'} interactive={false} track={false} lively={false} />
            <p className={cn('mt-1 max-w-full break-words text-center font-display text-base font-semibold', entry.you && 'text-primary')}>
              {entry.you ? 'You!' : entry.name}
            </p>
            <p className="text-sm font-bold text-muted-foreground">{Math.round(entry.percent)}%</p>
            <div className={cn('mt-2 grid w-full place-items-start justify-center rounded-t-2xl bg-gradient-to-b pt-2 shadow-inner', step.height, step.tone)}>
              <span className="font-celebrate text-2xl text-white drop-shadow">{step.label}</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function Row({ entry }: { entry: BoardEntry }) {
  return (
    <motion.li
      layout
      layoutId={entry.student_id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={spring.gentle}
      className={cn(
        'flex list-none items-center gap-3 rounded-2xl border-2 px-4 py-2.5',
        entry.you ? 'border-primary bg-selected shadow' : 'border-border bg-surface',
      )}
    >
      <span className="w-8 text-center font-display text-lg font-semibold text-muted-foreground">{entry.rank}</span>
      <BuddyAvatar buddy={entry.buddy} size={40} />
      <span className="min-w-0 flex-1 break-words font-bold">
        {entry.name}
        {entry.you && <Chip tone="grape" className="ml-2">You</Chip>}
      </span>
      <span className="font-display text-lg font-semibold">{Math.round(entry.percent)}%</span>
    </motion.li>
  )
}
