/**
 * Session state.
 *
 * The token lives in an httpOnly cookie the browser cannot read, so "am I
 * signed in?" is answered by asking the API, not by inspecting storage. That is
 * one request on load, and it is the price of the token being unreadable to
 * injected script.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiError, apiFetch } from './api'
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

interface AuthState {
  user: User | null
  /** True until the first /auth/me resolves, so routes do not flash. */
  loading: boolean
  signIn: (identifier: string, password: string) => Promise<void>
  signUpTeacher: (details: TeacherSignUp) => Promise<void>
  signUpStudent: (details: StudentSignUp) => Promise<JoinAtSignUp | null>
  signOut: () => Promise<void>
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

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

  const signIn = useCallback(async (identifier: string, password: string) => {
    setUser(
      await apiFetch<User>('/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      }),
    )
  }, [])

  const signUpTeacher = useCallback(async (details: TeacherSignUp) => {
    setUser(
      await apiFetch<User>('/auth/signup/teacher', {
        method: 'POST',
        body: JSON.stringify(details),
      }),
    )
  }, [])

  const signUpStudent = useCallback(async (details: StudentSignUp) => {
    const created = await apiFetch<User & { join?: JoinAtSignUp | null }>('/auth/signup/student', {
      method: 'POST',
      body: JSON.stringify(details),
    })
    const { join = null, ...account } = created
    setUser(account)
    return join
  }, [])

  const signOut = useCallback(async () => {
    try {
      await apiFetch<void>('/auth/signout', { method: 'POST' })
    } finally {
      // Whatever the server said, this browser is signed out.
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, signIn, signUpTeacher, signUpStudent, signOut, updateUser: setUser }),
    [user, loading, signIn, signUpTeacher, signUpStudent, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
