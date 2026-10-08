/** Which component plays which style (§23). A new style is its file and one line here. */
import type { ComponentType } from 'react'
import type { GameStyle } from '@/features/learning/api'
import { BubbleCatch } from './BubbleCatch'
import { LaneRunner } from './LaneRunner'
import { MatchBuild } from './MatchBuild'
import { QuestMap } from './QuestMap'
import type { StyleProps } from './types'

export const STYLE_PLAYERS: Record<GameStyle, ComponentType<StyleProps>> = {
  quest: QuestMap,
  runner: LaneRunner,
  catch: BubbleCatch,
  match: MatchBuild,
}

export type { StyleProps } from './types'
