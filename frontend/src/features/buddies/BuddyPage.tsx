import { useRef, useState } from 'react'
import { Confetti, HandWaving, Lightbulb, Moon, MusicNotes, Sparkle } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/features/auth/errors'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { firstName, type User } from '@/lib/user'
import { Page } from '@/motion'
import { Buddy, type BuddyHandle } from './Buddy'
import { BuddyPicker } from './BuddyPicker'
import { BuddyStage } from './BuddyStage'
import { BUDDIES, profileOf } from './profiles'
import { isBuddyKey, type BuddyKey } from './types'
import { pick, VOICES } from './voices'

interface Action {
  label: string
  Icon: Icon
  run: (buddy: BuddyHandle, key: BuddyKey) => void
}

const ACTIONS: Action[] = [
  { label: 'Wave', Icon: HandWaving, run: (b, k) => (b.play('wave'), b.say(pick(VOICES[k].hello))) },
  { label: 'Trick', Icon: Sparkle, run: (b) => b.trick() },
  { label: 'Dance', Icon: MusicNotes, run: (b) => b.play('dance', 4200) },
  { label: 'Cheer', Icon: Confetti, run: (b, k) => (b.play('celebrate', 3000), b.say(pick(VOICES[k].finish.great))) },
  { label: 'Think', Icon: Lightbulb, run: (b) => b.play('think', 3000) },
  { label: 'Nap', Icon: Moon, run: (b, k) => (b.play('sleepy', 4500), b.say(VOICES[k].sleepy)) },
]

/** Meet your buddy, play with them, or choose another. */
export default function BuddyPage() {
  const { user, updateUser } = useAuth()
  const { toast } = useToast()
  const figure = useRef<BuddyHandle>(null)
  const [saving, setSaving] = useState(false)
  const current = profileOf(user?.buddy)

  async function choose(key: BuddyKey) {
    if (!user || key === user.buddy) return
    const before = user
    updateUser({ ...user, buddy: key })
    setSaving(true)
    try {
      updateUser(await apiFetch<User>('/auth/me', { method: 'PATCH', body: JSON.stringify({ buddy: key }) }))
      toast(`${BUDDIES[key].name} is your buddy now!`, { tone: 'success' })
    } catch (error) {
      updateUser(before)
      toast('Could not change your buddy', { tone: 'error', body: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Your study buddy</h1>
      <p className="mt-1 text-muted-foreground">
        {user ? `${current.name} is always with you, ${firstName(user)}.` : ''} Tap them — they love it.
      </p>

      <BuddyStage buddy={current.key} className="mt-6 flex flex-col items-center px-4 pt-24 pb-6">
        <Buddy key={current.key} ref={figure} buddy={current.key} size={240} bubble="top" />
        <p className="mt-2 font-display text-3xl font-semibold">
          {current.name} <span className="text-muted-foreground">the {current.species}</span>
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {ACTIONS.map(({ label, Icon, run }) => (
            <Button key={label} variant="outline" size="sm" onClick={() => figure.current && run(figure.current, current.key)}>
              <Icon weight="duotone" className="size-4" />
              {label}
            </Button>
          ))}
        </div>
      </BuddyStage>

      <h2 className="mt-12 font-display text-2xl font-semibold">Choose a buddy</h2>
      <p className="mt-1 text-sm text-muted-foreground">You can change any time. Everyone gets their own.</p>
      <div className="mt-5" aria-busy={saving}>
        <BuddyPicker value={isBuddyKey(user?.buddy) ? user.buddy : null} onChange={(key) => void choose(key)} />
      </div>
    </Page>
  )
}
