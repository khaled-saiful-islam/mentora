/**
 * What the parts of a mission need to know of the game around them
 * (§28.3.2): whether sound is on — the game's own switch, remembered on this
 * device — so a sting, a ringing phone or a stamp is heard only when wanted.
 */
import { createContext, useContext } from 'react'

export const MissionContext = createContext<{ sound: boolean }>({ sound: false })

export function useMissionSound(): boolean {
  return useContext(MissionContext).sound
}
