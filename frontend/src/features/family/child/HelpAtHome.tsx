/**
 * Help at home (§28.3.3): a parent taps a skill their child finds hard and
 * gets three things —
 *
 * 1. **What it means**, in plain words, with one example;
 * 2. **Five minutes at home**, away from the screen: what you need, and the
 *    steps;
 * 3. **Send a challenge**: a short quiz on just that skill, at their year,
 *    which their buddy brings them when it is ready.
 *
 * In English or Malay. The first two are written once per skill and year,
 * then kept, so they come back at once.
 */
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle, Clock, Lightbulb, PaperPlaneTilt, Sparkle, Target } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Button, Skeleton } from '@/components/ui'
import { Dialog } from '@/components/ui/Dialog'
import { Segmented } from '@/components/ui/Segmented'
import { errorMessage } from '@/features/auth/errors'
import { BuddyAvatar } from '@/features/buddies'
import { profileOf } from '@/features/buddies/profiles'
import type { SkillInsight } from '@/features/play/api'
import { rise, stagger } from '@/motion'
import { helpAtHomeApi, type HelpLanguage, type SkillHelp } from '../api'

const LANGUAGES = [
  { value: 'en' as const, label: 'English' },
  { value: 'ms' as const, label: 'Bahasa Melayu' },
]

export function HelpAtHome({
  childId,
  first,
  buddy,
  skill,
  onClose,
}: {
  childId: string
  first: string
  buddy: string | null
  skill: SkillInsight | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={skill !== null}
      onClose={onClose}
      size="lg"
      title={skill ? `Help at home: ${skill.label}` : 'Help at home'}
      description={skill ? `${first} is getting ${Math.round(skill.mastery * 100)}% on this right now. Here's how to help.` : undefined}
    >
      {skill && <Sheet childId={childId} first={first} buddy={buddy} skill={skill} />}
    </Dialog>
  )
}

function Sheet({ childId, first, buddy, skill }: { childId: string; first: string; buddy: string | null; skill: SkillInsight }) {
  const [language, setLanguage] = useState<HelpLanguage>('en')
  const [help, setHelp] = useState<SkillHelp | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [asked, setAsked] = useState(0)

  useEffect(() => {
    let live = true
    setHelp(null)
    setFailed(null)
    helpAtHomeApi
      .help(childId, skill, language)
      .then((found) => live && setHelp(found))
      .catch((error: unknown) => live && setFailed(errorMessage(error)))
    return () => {
      live = false
    }
  }, [childId, skill, language, asked])

  return (
    <div className="space-y-5 pb-2">
      <Segmented options={LANGUAGES} value={language} onChange={setLanguage} label="Language" />
      {failed ? (
        <div className="rounded-2xl bg-wrong-soft p-4">
          <p className="break-words font-semibold">{failed}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setAsked((n) => n + 1)}>
            Try again
          </Button>
        </div>
      ) : help ? (
        <motion.div className="space-y-5" variants={stagger(0.12)} initial="hidden" animate="shown">
          <motion.section variants={rise} aria-labelledby="help-meaning">
            <h3 id="help-meaning" className="flex items-center gap-2 font-display text-lg font-semibold">
              <Lightbulb weight="fill" className="size-5 shrink-0 text-warning" aria-hidden />
              What it means
            </h3>
            <p className="mt-1 break-words">{help.meaning}</p>
            <p className="mt-2 break-words rounded-2xl bg-muted/60 px-4 py-3">
              <span className="font-bold">For example: </span>
              {help.example}
            </p>
          </motion.section>
          <motion.section variants={rise} aria-labelledby="help-activity" className="rounded-3xl border-2 border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="help-activity" className="flex items-center gap-2 font-display text-lg font-semibold">
                <Target weight="fill" className="size-5 shrink-0 text-primary" aria-hidden />
                <span className="break-words">{help.activity.title}</span>
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-sm font-bold text-muted-foreground">
                <Clock weight="bold" className="size-4" aria-hidden />
                {help.activity.minutes} min, no screen
              </span>
            </div>
            {help.activity.needs.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="What you need">
                {help.activity.needs.map((need) => (
                  <li key={need} className="break-words rounded-full bg-star-soft px-3 py-1 text-sm font-semibold">
                    {need}
                  </li>
                ))}
              </ul>
            )}
            <ol className="mt-3 space-y-2">
              {help.activity.steps.map((step, n) => (
                <li key={step} className="flex items-start gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n + 1}</span>
                  <span className="min-w-0 break-words">{step}</span>
                </li>
              ))}
            </ol>
          </motion.section>
        </motion.div>
      ) : (
        <div className="space-y-3" aria-label="Writing it for you" role="status">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
      <Challenge childId={childId} first={first} buddy={buddy} skill={skill} />
    </div>
  )
}

function Challenge({ childId, first, buddy, skill }: { childId: string; first: string; buddy: string | null; skill: SkillInsight }) {
  const [state, setState] = useState<'ready' | 'sending' | 'sent'>('ready')
  const [failed, setFailed] = useState<string | null>(null)
  const name = profileOf(buddy).name

  async function send() {
    setState('sending')
    setFailed(null)
    try {
      await helpAtHomeApi.challenge(childId, skill.slug)
      setState('sent')
    } catch (error) {
      setFailed(errorMessage(error))
      setState('ready')
    }
  }

  return (
    <section aria-labelledby="help-challenge" className="flex flex-col gap-3 rounded-3xl bg-selected p-4 sm:flex-row sm:items-center">
      <BuddyAvatar buddy={buddy} size={56} />
      <div className="min-w-0 flex-1">
        <h3 id="help-challenge" className="font-display text-lg font-semibold">
          Send {first} a challenge
        </h3>
        <AnimatePresence mode="wait" initial={false}>
          {state === 'sent' ? (
            <motion.p key="sent" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-1.5 break-words text-sm font-semibold text-success" role="status">
              <CheckCircle weight="fill" className="mt-0.5 size-4 shrink-0" aria-hidden />
              On its way! {name} will bring it to {first} in about a minute, and you'll hear how it went.
            </motion.p>
          ) : (
            <motion.p key="ask" className="break-words text-sm text-muted-foreground">
              A short quiz on just this skill, at {first}'s level. {name} brings it to them.
            </motion.p>
          )}
        </AnimatePresence>
        {failed && <p className="mt-1 break-words text-sm font-semibold text-destructive">{failed}</p>}
      </div>
      {state !== 'sent' && (
        <Button variant="sun" onClick={() => void send()} loading={state === 'sending'} className="shrink-0">
          {state === 'sending' ? <Sparkle weight="fill" className="size-5" /> : <PaperPlaneTilt weight="fill" className="size-5" />}
          Send a challenge
        </Button>
      )}
    </section>
  )
}
