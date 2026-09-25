import { useEffect, useState } from 'react'
import { getMakeable, type Makeable } from '@/lib/api'
import { useAuth } from '@/lib/auth'

const NOTHING: Makeable = { studio: [], learning: [], grounded: false }

/**
 * What this person may make: studio artifacts (posters and the rest) for
 * staff, and quizzes and flashcards for everyone who can make sets.
 *
 * Asked of the API rather than worked out here, because the answer is the
 * same capability the API enforces.
 */
export function useMakeable(): Makeable {
  const { user } = useAuth()
  const [makeable, setMakeable] = useState<Makeable>(NOTHING)
  const allowed = Boolean(
    user?.capabilities.studio_artifacts || user?.capabilities.share_learning_sets || user?.capabilities.make_practice_sets,
  )

  useEffect(() => {
    if (!allowed) {
      setMakeable(NOTHING)
      return
    }
    let cancelled = false
    getMakeable()
      .then((found) => {
        if (!cancelled) setMakeable(found)
      })
      .catch(() => {
        // Nothing to offer is a worse screen, not a broken one.
        if (!cancelled) setMakeable(NOTHING)
      })
    return () => {
      cancelled = true
    }
  }, [allowed])

  return makeable
}
