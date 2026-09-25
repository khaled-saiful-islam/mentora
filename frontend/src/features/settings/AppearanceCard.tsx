import { Desktop, Moon, SpeakerHigh, SpeakerSlash, Sun, TextAa, Waves, type Icon } from '@phosphor-icons/react'
import { Card } from '@/components/ui'
import { Segmented } from '@/components/ui/Segmented'
import { TextSizeControl } from '@/components/ui/TextSizeControl'
import { usePreferences } from '@/lib/prefs'
import { useTheme, type ThemeChoice } from '@/lib/theme'
import type { FontStyle, MotionChoice } from '@/lib/user'

const THEMES = [
  { value: 'light', label: 'Light', icon: <Sun weight="bold" className="size-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon weight="bold" className="size-4" /> },
  { value: 'system', label: 'Auto', icon: <Desktop weight="bold" className="size-4" /> },
] as const satisfies readonly { value: ThemeChoice; label: string; icon: React.ReactNode }[]

const FONTS = [
  { value: 'playful', label: 'Playful' },
  { value: 'classic', label: 'Classic' },
  { value: 'easy', label: 'Easy read' },
] as const satisfies readonly { value: FontStyle; label: string }[]

const MOTIONS = [
  { value: 'system', label: 'Auto' },
  { value: 'full', label: 'Lively' },
  { value: 'reduced', label: 'Calm' },
] as const satisfies readonly { value: MotionChoice; label: string }[]

/**
 * How Mentora looks and moves for you. Saved to your account, so it follows
 * you to every device — a student who needs big, calm text sets it once.
 */
export function AppearanceCard() {
  const { choice, setChoice } = useTheme()
  const { prefs, setPreference } = usePreferences()
  const save = (patch: Parameters<typeof setPreference>[0]) => void setPreference(patch).catch(() => {})

  return (
    <Card className="mt-8 space-y-7 p-6">
      <div>
        <h2 className="font-display text-xl font-semibold">Look and feel</h2>
        <p className="mt-1 text-sm text-muted-foreground">Saved to your account, on every device.</p>
      </div>

      <Row title="Theme" Icon={Sun}>
        <Segmented label="Theme" options={THEMES} value={choice} onChange={setChoice} />
      </Row>

      <Row title="Text size" Icon={TextAa}>
        <div className="flex flex-wrap items-center gap-4">
          <TextSizeControl />
          <span className="font-display text-lg font-semibold">The quick fox jumps!</span>
        </div>
      </Row>

      <Row title="Font style" Icon={TextAa}>
        <Segmented
          label="Font style"
          options={FONTS}
          value={prefs.font_style}
          onChange={(font_style) => save({ font_style })}
        />
      </Row>

      <Row title="Motion" Icon={Waves} hint="Calm keeps things still — no bouncing, flips become fades.">
        <Segmented
          label="Motion"
          options={MOTIONS}
          value={prefs.motion}
          onChange={(motion) => save({ motion })}
        />
      </Row>

      <Row title="Sounds" Icon={prefs.sound ? SpeakerHigh : SpeakerSlash} hint="Little blips for right answers and celebrations.">
        <Segmented
          label="Sounds"
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
          ]}
          value={prefs.sound ? 'on' : 'off'}
          onChange={(value) => save({ sound: value === 'on' })}
        />
      </Row>
    </Card>
  )
}

function Row({
  title,
  hint,
  Icon,
  children,
}: {
  title: string
  hint?: string
  Icon: Icon
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-[11rem_1fr] sm:items-center">
      <div className="flex items-center gap-2">
        <Icon weight="duotone" className="size-5 text-primary" />
        <div>
          <h3 className="font-bold">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground sm:max-w-40">{hint}</p>}
        </div>
      </div>
      <div>{children}</div>
    </section>
  )
}
