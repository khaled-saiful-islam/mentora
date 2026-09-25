import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Camera } from '@phosphor-icons/react'
import type { GuidePicture } from '@/features/learning/api'
import { cn } from '@/lib/utils'
import { useCalmMotion } from '@/motion'

/**
 * A section's picture, credited to the page it came from.
 *
 * Some sites refuse to be shown on someone else's page; then the search's own
 * small copy stands in, and if that fails too the frame steps aside rather
 * than leaving a broken-image icon in a child's guide. The picture drifts
 * very slowly, the way a documentary lingers on a photograph.
 */
export function PictureFrame({
  picture,
  alt,
  className,
  credit = true,
  drift = true,
}: {
  picture: GuidePicture | null
  alt: string
  className?: string
  credit?: boolean
  drift?: boolean
}) {
  const calm = useCalmMotion()
  const [source, setSource] = useState(picture?.image)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setSource(picture?.image)
    setBroken(false)
  }, [picture?.image])

  if (!picture || broken || !source) return null

  function fallBack() {
    if (picture && source !== picture.thumbnail) setSource(picture.thumbnail)
    else setBroken(true)
  }

  return (
    <figure className={cn('overflow-hidden rounded-[1.75rem] bg-muted shadow-press', className)}>
      <div className="relative aspect-[16/10] overflow-hidden">
        {/* The same picture, blurred, behind it: a diagram is shown whole —
            its labels are the point — without bars either side. */}
        <img src={source} alt="" aria-hidden referrerPolicy="no-referrer" className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl" />
        <motion.img
          key={source}
          src={source}
          alt={alt}
          loading="lazy"
          // Many image hosts turn away requests that say where they came from.
          referrerPolicy="no-referrer"
          onError={fallBack}
          className="absolute inset-0 size-full object-contain drop-shadow-lg"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={drift && !calm ? { opacity: 1, scale: [1, 1.04] } : { opacity: 1, scale: 1 }}
          transition={
            drift && !calm
              ? { opacity: { duration: 0.6 }, scale: { duration: 12, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' } }
              : { duration: 0.4 }
          }
        />
      </div>
      {credit && (picture.source || picture.page) && (
        <figcaption className="flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground">
          <Camera weight="bold" className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            Picture:{' '}
            {picture.page ? (
              <a href={picture.page} target="_blank" rel="noreferrer noopener" className="font-bold hover:underline">
                {picture.source || hostOf(picture.page)}
              </a>
            ) : (
              <span className="font-bold">{picture.source}</span>
            )}
          </span>
        </figcaption>
      )}
    </figure>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
