/**
 * The stage a rig is drawn at (§28.3.1), handed down to the frame, the head
 * and the eyes without every rig passing it along. Grown unless told — an
 * avatar in a list, a classmate on a podium.
 */
import { createContext, useContext } from 'react'
import { GROWN, LOOK, type Look, type Stage } from './growth'

export const StageLook = createContext<{ stage: Stage; calm: boolean }>({ stage: GROWN, calm: true })

export function useLook(): Look & { stage: Stage; calm: boolean } {
  const { stage, calm } = useContext(StageLook)
  return { ...LOOK[stage], stage, calm }
}
