/**
 * Display preferences — text size, font style, motion, sound — applied to the
 * whole document.
 *
 * The signed-in user's preferences are the truth; they arrive on /auth/me with
 * defaults already filled in for their role. A copy is kept in localStorage
 * only so the next page load paints at the right size before /auth/me answers
 * (see the script in index.html). Changes are applied at once and saved in the
 * background: a text-size button that waits for a round trip feels broken.
 */

import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import { apiFetch } from './api'
import { useAuth } from './auth'
import type { Preferences, User } from './user'

export const PREFS_STORAGE_KEY = 'mentora-prefs'

/** Before anyone signs in: the playful student look, since the sign-in screen
 *  is most often a child's first sight of the app. */
export const SIGNED_OUT: Preferences = {
  text_scale: 115,
  font_style: 'playful',
  motion: 'system',
  sound: false,
}

interface PrefsState {
  prefs: Preferences
  setPreference: (patch: Partial<Preferences>) => Promise<void>
}

const PrefsContext = createContext<PrefsState | null>(null)

export function applyToDocument(prefs: Preferences, root: HTMLElement = document.documentElement) {
  root.style.setProperty('--text-scale', String(prefs.text_scale / 100))
  root.setAttribute('data-font', prefs.font_style)
  root.setAttribute('data-motion', prefs.motion)
}

function remember(prefs: Preferences) {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Blocked storage: the next load paints at the default size first.
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUser } = useAuth()
  const prefs = user?.preferences ?? SIGNED_OUT

  useEffect(() => {
    applyToDocument(prefs)
    if (user) remember(prefs)
  }, [prefs, user])

  const setPreference = useCallback(
    async (patch: Partial<Preferences>) => {
      if (!user) return
      const optimistic = { ...user, preferences: { ...user.preferences, ...patch } }
      updateUser(optimistic)
      try {
        updateUser(
          await apiFetch<User>('/auth/me/preferences', {
            method: 'PATCH',
            body: JSON.stringify(patch),
          }),
        )
      } catch (error) {
        // Put back what the server still holds, and let the caller say so.
        updateUser(user)
        throw error
      }
    },
    [user, updateUser],
  )

  const value = useMemo(() => ({ prefs, setPreference }), [prefs, setPreference])
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePreferences(): PrefsState {
  const context = useContext(PrefsContext)
  if (!context) throw new Error('usePreferences must be used inside <PreferencesProvider>')
  return context
}
