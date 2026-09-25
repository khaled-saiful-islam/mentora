/**
 * A new student's first minute: choose a study buddy, meet them, go.
 * Saves the buddy and marks the student onboarded, so it shows once.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { firstName, type User } from '@/lib/user'
import { spring } from '@/motion'
import { Buddy, type BuddyHandle } from './Buddy'
import { BuddyPicker } from './BuddyPicker'
import { BuddyStage } from './BuddyStage'
import { BUDDIES } from './profiles'
import { isBuddyKey, type BuddyKey } from './types'

const PROMISES = ['cheer you on in every quiz', 'give you tips when things get tricky', 'keep you company while you learn']

export function Welcome() {
  const { user, updateUser } = useAuth()
  const { toast } = useToast()
  const [chosen, setChosen] = useState<BuddyKey | null>(isBuddyKey(user?.buddy) ? user.buddy : null)
  const [step, setStep] = useState<'choose' | 'meet'>('choose')
  const [saving, setSaving] = useState(false)
  const buddy = useRef<BuddyHandle>(null)
  const name = user ? firstName(user) : 'friend'

  async function start() {
    if (!user || !chosen) return
    setSaving(true)
    try {
      await apiFetch<User>('/auth/me', { method: 'PATCH', body: JSON.stringify({ buddy: chosen }) })
      updateUser(await apiFetch<User>('/auth/me/onboarded', { method: 'POST' }))
    } catch (error) {
      toast('Could not save that', { tone: 'error', body: errorMessage(error) })
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-4 py-8">
      <AnimatePresence mode="wait">
        {step === 'choose' ? (
          <motion.section key="choose" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} transition={spring.gentle}>
            <p className="font-display text-xl font-semibold text-muted-foreground">Welcome to Mentora, {name}!</p>
            <h1 className="font-celebrate text-4xl md:text-5xl">Pick your study buddy</h1>
            <p className="mt-2 text-lg text-muted-foreground">They'll learn alongside you. Tap one to say hello!</p>
            <div className="mt-6">
              <BuddyPicker value={chosen} onChange={setChosen} />
            </div>
            <div className="mt-6 flex justify-end">
              <Button size="lg" disabled={!chosen} onClick={() => setStep('meet')}>
                {chosen ? `Choose ${BUDDIES[chosen].name}` : 'Choose one'}
                <ArrowRight weight="bold" className="size-5" />
              </Button>
            </div>
          </motion.section>
        ) : (
          chosen && (
            <motion.section
              key="meet"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={spring.gentle}
              // Say hello once they are actually on screen.
              onAnimationComplete={() => buddy.current?.cue('hello', { name })}
            >
              <BuddyStage buddy={chosen} className="flex flex-col items-center px-4 pt-28 pb-8 text-center">
                <Buddy ref={buddy} buddy={chosen} size={220} mood="happy" bubble="top" />
                <h1 className="mt-3 font-celebrate text-4xl md:text-5xl">
                  {BUDDIES[chosen].name} and {name}!
                </h1>
                <ul className="mt-4 space-y-1 text-lg">
                  {PROMISES.map((promise, i) => (
                    <motion.li key={promise} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.25 }}>
                      {BUDDIES[chosen].name} will {promise}.
                    </motion.li>
                  ))}
                </ul>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <Button size="lg" variant="ghost" onClick={() => setStep('choose')} disabled={saving}>
                    Pick again
                  </Button>
                  <Button size="lg" variant="sun" onClick={() => void start()} loading={saving}>
                    Let's go!
                    <ArrowRight weight="bold" className="size-5" />
                  </Button>
                </div>
              </BuddyStage>
            </motion.section>
          )
        )}
      </AnimatePresence>
    </div>
  )
}
