/**
 * *Change it* (§24.2): a game's code changed by asking — "make the sun slider
 * bigger", "add a rain button". The change is made in the background, then the
 * game is tested exactly as a new one is; one that fails is not kept, and the
 * game stays as it was. The work tray and the bell follow it too.
 */
import { motion } from 'motion/react'
import { CheckCircle, CircleNotch, MagicWand, WarningCircle } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Button, Card } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { learningApi, type GameStatus } from './api'

const LIMIT = 400
const POLL_MS = 3000
const EXAMPLES = 'e.g. make the sun slider bigger, add a rain button, slow the plant down'

export function GameChanges({ setId }: { setId: string }) {
  const [status, setStatus] = useState<GameStatus | null>(null)
  const [asked, setAsked] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    let stopped = false
    let timer = 0
    const look = async () => {
      try {
        const found = await learningApi.gameStatus(setId)
        if (stopped) return
        setStatus((before) => {
          if (before?.changing && !found.changing) tell(found)
          return found
        })
        if (found.changing) timer = window.setTimeout(() => void look(), POLL_MS)
      } catch {
        // No game code yet (still being made): nothing to change.
      }
    }
    const tell = (found: GameStatus) =>
      found.change?.type === 'done'
        ? toast('Your game is changed', { body: 'Play it to see the change.' })
        : toast('That change was not kept', { tone: 'error', body: found.change?.message ?? 'Your game is as it was.' })
    if (!status || status.changing) void look()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [setId, status?.changing])

  async function change(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setStatus(await learningApi.changeGame(setId, asked.trim()))
      setAsked('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!status) return null
  const changing = status.changing
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <MagicWand weight="duotone" className="size-5 text-primary" aria-hidden />
        Change the game
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Say what to change. It is rewritten and tested again — a change that breaks it is not kept. Version {status.revision}.
      </p>
      {changing ? (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex items-start gap-2 rounded-2xl bg-selected px-3 py-2 font-semibold" aria-live="polite">
          <CircleNotch weight="bold" className="mt-0.5 size-5 shrink-0 animate-spin text-primary" aria-hidden />
          <span className="min-w-0 break-words">
            {status.change?.label ?? 'Making the change'}
            {status.change?.detail ? <span className="block text-sm font-normal text-muted-foreground">{status.change.detail}</span> : null}
          </span>
        </motion.p>
      ) : (
        <form onSubmit={change} className="mt-3 space-y-2">
          <textarea
            aria-label="What to change"
            rows={2}
            maxLength={LIMIT}
            value={asked}
            onChange={(e) => setAsked(e.target.value)}
            placeholder={EXAMPLES}
            className="w-full resize-y rounded-2xl border-2 border-input bg-surface px-3 py-2 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={busy} disabled={asked.trim().length < 3}>
              {!busy && <MagicWand weight="bold" className="size-4" />}
              Change it
            </Button>
            {status.change?.type === 'done' && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                <CheckCircle weight="fill" className="size-4" aria-hidden /> Changed — play it to see
              </span>
            )}
            {status.change?.type === 'failed' && (
              <span className="inline-flex items-start gap-1 text-sm font-semibold text-destructive">
                <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="break-words">{status.change.message}</span>
              </span>
            )}
          </div>
          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
        </form>
      )}
    </Card>
  )
}
