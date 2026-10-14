/**
 * Following a battle (§28.3.6): the latest view of the room, reconnecting
 * after a drop, until the battle is done.
 */
import { useEffect, useState } from 'react'
import { battleViews, type BattleView } from './api'

const RETRY_MS = 1500

export function useBattle(id: string, first: BattleView | null = null) {
  const [view, setView] = useState<BattleView | null>(first)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let retry = 0
    async function run() {
      while (!controller.signal.aborted) {
        try {
          for await (const next of battleViews(id, controller.signal)) {
            setProblem(null)
            setView(next)
            if (next.phase === 'done') return
          }
        } catch (error) {
          if (controller.signal.aborted) return
          setProblem(error instanceof Error ? error.message : 'The battle could not be reached.')
          if (error instanceof Error && error.message === 'That battle is over.') return
        }
        await new Promise((resolve) => {
          retry = window.setTimeout(resolve, RETRY_MS)
        })
      }
    }
    void run()
    return () => {
      controller.abort()
      window.clearTimeout(retry)
    }
  }, [id])

  return { view, problem, setView }
}
