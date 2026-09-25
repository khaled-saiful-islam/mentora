import { useCallback, useEffect, useRef, useState } from 'react'

export interface Resource<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => Promise<void>
  /** Replace the data locally — an optimistic update, or the server's reply. */
  setData: (update: T | ((current: T | null) => T)) => void
}

/**
 * Load something once its key is known, and again on demand.
 *
 * A late answer for an old key is dropped: switching classes quickly must not
 * show the first class's students under the second class's name.
 */
export function useResource<T>(key: string | null, fetcher: () => Promise<T>): Resource<T> {
  const [data, setDataState] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(key !== null)
  const latest = useRef(0)
  const fetchRef = useRef(fetcher)
  fetchRef.current = fetcher

  const reload = useCallback(async () => {
    if (key === null) return
    const ticket = ++latest.current
    setLoading(true)
    try {
      const value = await fetchRef.current()
      if (ticket === latest.current) {
        setDataState(value)
        setError(null)
      }
    } catch (err) {
      if (ticket === latest.current) setError(err instanceof Error ? err.message : 'Could not load this.')
    } finally {
      if (ticket === latest.current) setLoading(false)
    }
  }, [key])

  useEffect(() => {
    setDataState(null)
    void reload()
  }, [reload])

  const setData = useCallback((update: T | ((current: T | null) => T)) => {
    setDataState((current) =>
      typeof update === 'function' ? (update as (c: T | null) => T)(current) : update,
    )
  }, [])

  return { data, error, loading, reload, setData }
}
