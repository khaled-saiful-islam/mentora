import { ArrowUpRight, CircleNotch, Eye, WarningCircle } from '@phosphor-icons/react'
import { colourOf, lookOf } from '@/components/artifacts/kind-look'
import { Scene } from '@/components/make/Scene'
import type { Artifact, ArtifactBuild } from '@/lib/chat-types'
import { cn } from '@/lib/utils'

/**
 * The artifact in the transcript.
 *
 * A card, never the document: a poster in a chat bubble is four hundred lines
 * of CSS nobody asked for, and the panel is where it belongs. The card wears
 * its kind — colour and a few moving pixels of what it is — so three in one
 * conversation can be told apart across the room, and says plainly what
 * pressing it does.
 */
export function ArtifactCard({
  artifact,
  build,
  active,
  onOpen,
}: {
  artifact?: Artifact
  build?: ArtifactBuild | null
  active?: boolean
  onOpen: () => void
}) {
  const failed = !!build?.failed
  const busy = !!build && !artifact && !failed
  const title = artifact?.title ?? build?.title ?? 'Artifact'
  const kind = artifact?.kind ?? build?.kind ?? 'artifact'
  const step = build?.steps[build.steps.length - 1]
  const look = lookOf(kind)
  const Glyph = look.icon

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={busy}
      aria-label={busy ? `${title}, being made` : `Open ${title}`}
      data-live={busy || active}
      className={cn(
        'make-tile group mb-4 flex w-full max-w-md items-center gap-3 p-2.5 pr-3 text-left',
        failed && 'border-destructive/40',
        active && 'ring-2 ring-offset-2 ring-offset-background',
        active && !failed && look.ring,
      )}
      style={{ ['--tile' as string]: failed ? 'hsl(var(--destructive))' : colourOf(kind) }}
    >
      <span className="make-stage relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl">
        {failed ? (
          <WarningCircle weight="duotone" className="size-7 text-destructive" aria-hidden />
        ) : (
          <span className="scale-[0.8]">
            <Scene kind={kind} />
          </span>
        )}
        <span className={cn('absolute bottom-1 right-1 grid size-5 place-items-center rounded-md shadow-sm', failed ? 'bg-destructive text-white' : look.tile)}>
          {busy ? <CircleNotch weight="bold" className="size-3 animate-spin" aria-hidden /> : <Glyph weight="bold" className="size-3" aria-hidden />}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block break-words font-display text-base font-bold leading-snug">{title}</span>
        <span className={cn('mt-0.5 block text-sm', failed ? 'text-destructive' : 'text-muted-foreground')}>
          {failed ? (
            `Could not finish — the ${kind === 'artifact' ? 'artifact' : kind} is unchanged`
          ) : busy ? (
            <span className="shimmer font-semibold">{step?.label ?? 'Starting'}…</span>
          ) : (
            <>
              <span className="font-bold capitalize" style={{ color: 'var(--tile)' }}>
                {kind}
              </span>
              {artifact && <span> · version {artifact.version}</span>}
            </>
          )}
        </span>
        {busy && (
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="block h-full w-1/3 animate-[artifact-sweep_1.4s_ease-in-out_infinite] rounded-full" style={{ background: 'var(--tile)' }} />
          </span>
        )}
      </span>

      {!busy && !failed && (
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold transition-colors',
            active ? 'text-white' : 'bg-muted text-foreground group-hover:bg-[var(--tile)] group-hover:text-white',
          )}
          style={active ? { background: 'var(--tile)' } : undefined}
        >
          {active ? <Eye weight="bold" className="size-4" aria-hidden /> : <ArrowUpRight weight="bold" className="size-4" aria-hidden />}
          {active ? 'Showing' : 'Open'}
        </span>
      )}
    </button>
  )
}
