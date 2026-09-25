import { useEffect, useState } from 'react'
import { getMakeable, type MakeableKind } from '@/lib/api'
import { useAuth } from '@/lib/auth'

/**
 * The studio kinds this person may make — posters, slides and the rest.
 *
 * Asked of the API rather than worked out here, because the answer is the
 * same capability the API enforces. A student gets an empty list, not an
 * error.
 */
export function useMakeable(): MakeableKind[] {
  const { user } = useAuth()
  const [kinds, setKinds] = useState<MakeableKind[]>([])
  const allowed = Boolean(user?.capabilities.studio_artifacts)

  useEffect(() => {
    if (!allowed) {
      setKinds([])
      return
    }
    let cancelled = false
    getMakeable()
      .then((found) => {
        if (!cancelled) setKinds(found.studio)
      })
      .catch(() => {
        // No tiles is a worse screen, not a broken one.
        if (!cancelled) setKinds([])
      })
    return () => {
      cancelled = true
    }
  }, [allowed])

  return kinds
}
