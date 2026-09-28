/**
 * Signing out asks first: it is one tap from the corner of every screen, and
 * a child who taps it by accident needs their password to get back in. The
 * question is drawn over the whole page, so a sidebar that clips or slides
 * cannot hide it.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Confirm } from '@/components/ui/Confirm'
import { useAuth } from '@/lib/auth'

export function useSignOut(): { ask: () => void; dialog: React.ReactNode } {
  const { signOut } = useAuth()
  const [asking, setAsking] = useState(false)
  const dialog = asking
    ? createPortal(
        <Confirm
          title="Sign out of Mentora?"
          body="You'll need your username or email and your password to sign back in."
          confirmLabel="Sign out"
          destructive={false}
          onConfirm={() => {
            setAsking(false)
            void signOut()
          }}
          onCancel={() => setAsking(false)}
        />,
        document.body,
      )
    : null
  return { ask: () => setAsking(true), dialog }
}
