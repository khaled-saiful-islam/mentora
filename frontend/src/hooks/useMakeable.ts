import { useEffect, useState } from 'react'
import { getMakeable, type Makeable } from '@/lib/api'
import { useAuth } from '@/lib/auth'

const NOTHING: Makeable = { studio: [], learning: [], grounded: false }

/**
 * What this person may make: studio artifacts (posters and the rest) for
 * staff, and quizzes and flashcards for everyone who can make sets —
 * teachers, students for practice, and parents to send home.
 *
 * Asked of the API rather than worked out here, because the answer is the
 * same capability the API enforces.
 */
export function useMakeable(): Makeable {
  const { user } = useAuth()
  const [makeable, setMakeable] = useState<Makeable>(NOTHING)
  const caps = user?.capabilities
  const allowed = Boolean(caps?.studio_artifacts || caps?.share_learning_sets || caps?.make_practice_sets || caps?.make_family_sets)

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
