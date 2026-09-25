/**
 * What the safety checks caught, for a person to look at. A student who may
 * be at risk comes first and is flagged plainly; what they said is shown only
 * when the reviewer chooses to see it.
 */
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowCounterClockwise,
  ArrowUUpLeft,
  Bug,
  Check,
  Eye,
  EyeSlash,
  Heartbeat,
  Prohibit,
  ShieldCheck,
  X,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useCallback, useEffect, useState } from 'react'
import { useLive } from '@/lib/bus'
import { Alert, Button, Chip, Skeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { EmptyArt } from '@/features/classes/EmptyArt'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { rise, stagger } from '@/motion'
import { adminApi, type ModerationItem, type ModerationStatus } from './api'

interface KindLook {
  label: string
  Icon: Icon
  tone: string
}

const KINDS: Record<string, KindLook> = {
  support: { label: 'May need support', Icon: Heartbeat, tone: 'bg-wrong text-white' },
  held: { label: 'Message refused', Icon: Prohibit, tone: 'bg-sun-400 text-grape-900' },
  redacted: { label: 'Personal details removed', Icon: EyeSlash, tone: 'bg-sky-400 text-white' },
  retracted: { label: 'Answer withdrawn', Icon: ArrowUUpLeft, tone: 'bg-kind-quiz-vivid text-white' },
  injection: { label: 'Instruction hidden in text', Icon: Bug, tone: 'bg-grape-500 text-white' },
  topic_refused: { label: 'Topic refused', Icon: Prohibit, tone: 'bg-muted-foreground text-white' },
}
const FALLBACK: KindLook = { label: 'Flagged', Icon: ShieldCheck, tone: 'bg-muted-foreground text-white' }

const STATUS = [
  { value: 'open', label: 'To look at' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
] as const

const SEVERITY = [
  { value: '', label: 'Any' },
  { value: 'high', label: 'Urgent' },
  { value: 'medium', label: 'Check' },
  { value: 'low', label: 'Low' },
] as const

const human = (text: string) => text.replace(/[_:]/g, ' ')

export function SafetyTab({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState<(typeof STATUS)[number]['value']>('open')
  const [severity, setSeverity] = useState<(typeof SEVERITY)[number]['value']>('')
  const [items, setItems] = useState<ModerationItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [more, setMore] = useState(false)

  const load = useCallback(
    async (before?: string) => {
      try {
        const page = await adminApi.moderation({ status, severity, before })
        setItems((now) => (before && now ? [...now, ...page.items] : page.items))
        setMore(page.items.length >= 50)
        setError(null)
      } catch (err) {
        setError(errorMessage(err))
      }
    },
    [status, severity],
  )

  useEffect(() => {
    setItems(null)
    void load()
  }, [load])
  // Live: a new item lands in the queue while it is open.
  useLive(['moderation'], () => void load())

  const decided = (item: ModerationItem) => {
    setItems((now) => (status === 'all' ? now?.map((i) => (i.id === item.id ? item : i)) : now?.filter((i) => i.id !== item.id)) ?? null)
    onChange()
  }

  // The most serious first: a child at risk is never below a spam finding.
  const ordered = [...(items ?? [])].sort((a, b) => rank(b) - rank(a) || b.created_at.localeCompare(a.created_at))
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <Segmented label="Status" value={status} onChange={setStatus} options={STATUS} />
        <Segmented label="How serious" value={severity} onChange={setSeverity} options={SEVERITY} />
      </div>
      {error && <Alert className="mt-4">{error}</Alert>}
      {!items ? (
        <div className="mt-4 space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <EmptyState className="mt-6" art={<EmptyArt Icon={ShieldCheck} tone="from-mint-100 to-sky-100" />} title="Nothing to look at" body="When a safety check acts, it shows up here." />
      ) : (
        <motion.ul className="mt-4 space-y-3" variants={stagger(0.04)} initial="hidden" animate="shown">
          <AnimatePresence initial={false}>
            {ordered.map((item) => (
              <Case key={item.id} item={item} onDecided={decided} />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
      {more && items && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => void load(items[items.length - 1]?.created_at)}>Show older</Button>
        </div>
      )}
    </div>
  )
}

function rank(item: ModerationItem): number {
  return (item.status === 'open' ? 10 : 0) + { high: 3, medium: 2, low: 1 }[item.severity]
}

function Case({ item, onDecided }: { item: ModerationItem; onDecided: (item: ModerationItem) => void }) {
  const { toast } = useToast()
  const look = KINDS[item.kind] ?? FALLBACK
  const sensitive = item.kind === 'support'
  const [shown, setShown] = useState(!sensitive)
  const [note, setNote] = useState(item.note)
  const [busy, setBusy] = useState(false)

  async function decide(status: ModerationStatus) {
    setBusy(true)
    try {
      onDecided(await adminApi.review(item.id, status, note))
      toast(status === 'open' ? 'Opened again' : status === 'reviewed' ? 'Marked as reviewed' : 'Dismissed', { tone: 'success' })
    } catch (error) {
      toast('That did not save', { tone: 'error', body: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.li variants={rise} layout exit={{ opacity: 0, x: 40 }} className={cn('overflow-hidden rounded-3xl border-2 bg-surface', item.severity === 'high' && item.status === 'open' ? 'border-wrong' : 'border-border')}>
      <div className="flex flex-wrap items-center gap-2 p-4 pb-2">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold', look.tone)}>
          <look.Icon weight="fill" className="size-4" />
          {look.label}
        </span>
        {item.category !== 'none' && <Chip className="capitalize">{human(item.category)}</Chip>}
        <Chip tone={item.severity === 'high' ? 'coral' : item.severity === 'medium' ? 'sun' : 'neutral'} className="capitalize">{item.severity}</Chip>
        <span className="ml-auto text-sm text-muted-foreground">{timeAgo(item.created_at)}</span>
      </div>
      <div className="px-4 pb-4">
        <p className="font-bold">
          {item.user ? item.user.name : 'No account'}
          {item.user && (
            <span className="font-normal text-muted-foreground">
              {' '}· <span className="capitalize">{item.user.role}</span>
              {item.user.grade_label ? ` · ${item.user.grade_label}` : ''}
            </span>
          )}
        </p>
        {sensitive && item.status === 'open' && (
          <p className="mt-2 rounded-2xl bg-wrong-soft p-3 text-sm">
            They were shown helplines and told to talk to a trusted adult. Please follow your school's safeguarding steps today — for example, let their teacher or counsellor know.
          </p>
        )}
        {item.excerpt && (
          shown ? (
            <blockquote className="mt-3 rounded-2xl border-l-4 border-border bg-muted/50 px-4 py-3 whitespace-pre-wrap">{item.excerpt}</blockquote>
          ) : (
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setShown(true)}>
              <Eye weight="bold" className="size-4" />
              Show what they said
            </Button>
          )
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {human(item.source)} · {item.screen || 'check'}{item.rule ? ` · ${human(item.rule)}` : ''}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`note-${item.id}`}>Note</label>
          <input
            id={`note-${item.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Add a note (optional)"
            className="h-9 min-w-48 flex-1 rounded-full border-2 border-input bg-surface px-4 text-sm focus:border-ring focus:outline-none"
          />
          {item.status === 'open' ? (
            <>
              <Button size="sm" onClick={() => void decide('reviewed')} loading={busy}>
                <Check weight="bold" className="size-4" />
                Reviewed
              </Button>
              <Button size="sm" variant="outline" onClick={() => void decide('dismissed')} disabled={busy}>
                <X weight="bold" className="size-4" />
                Dismiss
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => void decide('open')} loading={busy}>
              <ArrowCounterClockwise weight="bold" className="size-4" />
              Reopen
            </Button>
          )}
        </div>
      </div>
    </motion.li>
  )
}
