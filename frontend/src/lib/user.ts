/**
 * Who is signed in, as the API describes them.
 *
 * `capabilities` are the backend's own decisions (app/policies/capabilities.py)
 * sent along with the user. The interface shapes itself from them; the API
 * enforces them. Never the other way round.
 */

export type Role = 'admin' | 'teacher' | 'student'

export type TextScale = 90 | 100 | 115 | 130 | 150
export type FontStyle = 'playful' | 'classic' | 'easy'
export type MotionChoice = 'system' | 'reduced' | 'full'

export interface Preferences {
  text_scale: TextScale
  font_style: FontStyle
  motion: MotionChoice
  sound: boolean
}

export interface Capabilities {
  studio_artifacts: boolean
  share_learning_sets: boolean
  make_practice_sets: boolean
  manage_classes: boolean
  join_classes: boolean
  take_assignments: boolean
  moderate: boolean
  manage_users: boolean
  share_conversations: boolean
  see_usage: boolean
}

export interface User {
  id: string
  username: string | null
  email: string | null
  display_name: string | null
  role: Role
  is_admin: boolean
  grade_level: string | null
  grade_label: string | null
  buddy: string | null
  preferences: Preferences
  onboarded: boolean
  capabilities: Capabilities
  created_at: string
}

export const TEXT_SCALES: readonly TextScale[] = [90, 100, 115, 130, 150]

/** What to call someone: their name, else what they sign in with. */
export function nameOf(user: Pick<User, 'display_name' | 'username' | 'email'>): string {
  return user.display_name || user.username || user.email || 'You'
}

/** The first name, for "Hi, Adam!" — kinder than a full name on a greeting. */
export function firstName(user: Pick<User, 'display_name' | 'username' | 'email'>): string {
  return nameOf(user).split(/\s+/)[0]
}

export function can(user: User | null, capability: keyof Capabilities): boolean {
  return Boolean(user?.capabilities?.[capability])
}
