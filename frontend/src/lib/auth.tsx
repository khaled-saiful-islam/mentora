/**
 * Session state.
 *
 * The token lives in an httpOnly cookie the browser cannot read, so "am I
 * signed in?" is answered by asking the API, not by inspecting storage. That is
 * one request on load, and it is the price of the token being unreadable to
 * injected script.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, apiFetch } from './api'
import { announceSession, isSomeoneElse, onSessionChange, startOver } from './sessionSync'
import type { User } from './user'

export type { User } from './user'

export interface TeacherSignUp {
  name: string
  email: string
  password: string
}

/** What happened to the invite a student signed up through. */
export interface JoinAtSignUp {
  status: 'requested' | 'pending' | 'member' | 'invalid'
  class_name: string | null
  teacher_name: string | null
}

export interface StudentSignUp {
  name: string
  grade_level: string
  username: string
  password: string
  /** From a class invite link: signing up through one also asks to join. */
  invite_token?: string
}

export interface ParentSignUp {
  name: string
  email: string
  password: string
  /** From a child's invitation: signing up through one also connects. */
  invite?: string
  /** What the child calls them: Mum, Dad, Guardian… */
  label?: string
}

/** What happened to the invitation a parent signed up through. */
export interface ConnectAtSignUp {
  status: 'connected' | 'invalid'
  child_name: string | null
}

/**
 * Run once the server has said yes and before the app moves on — the
 * signed-out pages leave the moment there is a user, so a welcome that should
 * be seen happens here. It cannot fail the sign-in: the account is real.
 */
export type BeforeEntering = () => Promise<void>

async function settle(before?: BeforeEntering): Promise<void> {
  try {
    await before?.()
  } catch {
    // A flourish that broke must not keep someone out of their account.
  }
}

interface AuthState {
  user: User | null
  /** True until the first /auth/me resolves, so routes do not flash. */
  loading: boolean
  signIn: (identifier: string, password: string, before?: BeforeEntering) => Promise<void>
  signUpTeacher: (details: TeacherSignUp, before?: BeforeEntering) => Promise<void>
  signUpStudent: (details: StudentSignUp, before?: BeforeEntering) => Promise<JoinAtSignUp | null>
  signUpParent: (details: ParentSignUp, before?: BeforeEntering) => Promise<ConnectAtSignUp | null>
  signOut: () => Promise<void>
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useFollowOtherTabs(user?.id ?? null, loading)

  useEffect(() => {
    apiFetch<User>('/auth/me')
      .then(setUser)
      .catch((error: unknown) => {
        // A 401 here is the normal "not signed in" case, not a failure.
        if (!(error instanceof ApiError) || error.status !== 401) {
          console.error('Could not restore session', error)
        }
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(async (identifier: string, password: string, before?: BeforeEntering) => {
    const account = await apiFetch<User>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    })
    await settle(before)
    setUser(account)
    announceSession(account.id)
  }, [])

  const signUpTeacher = useCallback(async (details: TeacherSignUp, before?: BeforeEntering) => {
    const account = await apiFetch<User>('/auth/signup/teacher', {
      method: 'POST',
      body: JSON.stringify(details),
    })
    await settle(before)
    setUser(account)
    announceSession(account.id)
  }, [])

  const signUpStudent = useCallback(async (details: StudentSignUp, before?: BeforeEntering) => {
    const created = await apiFetch<User & { join?: JoinAtSignUp | null }>('/auth/signup/student', {
      method: 'POST',
      body: JSON.stringify(details),
    })
    const { join = null, ...account } = created
    await settle(before)
    setUser(account)
    announceSession(account.id)
    return join
  }, [])

  const signUpParent = useCallback(async (details: ParentSignUp, before?: BeforeEntering) => {
    const created = await apiFetch<User & { connect?: ConnectAtSignUp | null }>('/auth/signup/parent', {
      method: 'POST',
      body: JSON.stringify(details),
    })
    const { connect = null, ...account } = created
    await settle(before)
    setUser(account)
    announceSession(account.id)
    return connect
  }, [])

  const signOut = useCallback(async () => {
    try {
      await apiFetch<void>('/auth/signout', { method: 'POST' })
    } finally {
      // Whatever the server said, this browser is signed out.
      setUser(null)
      announceSession(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, signIn, signUpTeacher, signUpStudent, signUpParent, signOut, updateUser: setUser }),
    [user, loading, signIn, signUpTeacher, signUpStudent, signUpParent, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Keep this tab honest about who it is (`sessionSync.ts`): another tab's
 * sign-in or sign-out, or a different account found on coming back, starts
 * this one over rather than letting it act for the wrong person.
 */
function useFollowOtherTabs(userId: string | null, loading: boolean): void {
  const shown = useRef(userId)
  shown.current = userId
  useEffect(() => {
    if (loading) return
    const stop = onSessionChange((now) => {
      if (isSomeoneElse(shown.current, now)) startOver()
    })
    const onShow = () => {
      if (document.visibilityState !== 'visible') return
      apiFetch<User>('/auth/me').then(
        (now) => isSomeoneElse(shown.current, now.id) && startOver(),
        (error: unknown) => {
          // Signed out elsewhere: a signed-in page must not stay up.
          if (error instanceof ApiError && error.status === 401 && shown.current !== null) startOver()
        },
      )
    }
    document.addEventListener('visibilitychange', onShow)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [loading])
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
