/**
 * Start a Class Battle (§28.3.6) from a quiz or a game: which class, and
 * which battle — a Tug-of-War between two teams, or the whole class against
 * the boss. The class screen opens; students are told, and join on their
 * own devices.
 */
import { Sword, UsersThree, type Icon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card } from '@/components/ui'
import { errorMessage } from '@/features/auth/errors'
import { classesApi } from '@/features/classes/api'
import { useResource } from '@/hooks/useResource'
import { cn } from '@/lib/utils'
import { battleApi, type BattleMode } from './api'

const MODES: { value: BattleMode; label: string; Icon: Icon }[] = [
  { value: 'tug', label: 'Tug-of-War', Icon: UsersThree },
  { value: 'boss', label: 'Class vs Boss', Icon: Sword },
]

export function OpenBattle({ setId }: { setId: string }) {
  const classes = useResource('battle:classes', () => classesApi.list())
  const items = classes.data?.items ?? []
  const [classId, setClassId] = useState('')
  const [mode, setMode] = useState<BattleMode>('tug')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!classId && items.length > 0) setClassId(items[0].id)
  }, [classId, items])

  async function open() {
    if (!classId) return
    setBusy(true)
    setProblem(null)
    try {
      const battle = await battleApi.open(classId, setId, mode)
      navigate(`/battle/${battle.id}`)
    } catch (error) {
      setProblem(errorMessage(error))
      setBusy(false)
    }
  }

  if (classes.data && items.length === 0) return null
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Sword weight="duotone" className="size-5 text-primary" aria-hidden />
        Class Battle, live
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">On your class screen; students answer on their own devices. Nobody is ranked.</p>
      <div className="mt-3 space-y-3">
        <div role="radiogroup" aria-label="Battle" className="grid grid-cols-2 gap-2">
          {MODES.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center text-sm font-bold break-words',
                mode === value ? 'border-primary bg-selected text-foreground' : 'border-border bg-surface text-muted-foreground hover:bg-hover',
              )}
            >
              <Icon weight="fill" className="size-5 shrink-0" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{mode === 'tug' ? 'Two teams: every right answer pulls the rope.' : 'Everyone together: every right answer hits the boss.'}</p>
        <label className="block text-sm font-bold">
          Class
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="mt-1 h-10 w-full rounded-xl border-2 border-border bg-surface px-3 font-semibold">
            {items.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} ({room.students})
              </option>
            ))}
          </select>
        </label>
        {problem && <Alert>{problem}</Alert>}
        <Button onClick={() => void open()} loading={busy} disabled={!classId}>
          Open the battle
        </Button>
      </div>
    </Card>
  )
}
