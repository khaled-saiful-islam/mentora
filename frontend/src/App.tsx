import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { PreferencesProvider } from '@/lib/prefs'
import { ThemeProvider } from '@/lib/theme'
import { MotionProvider } from '@/motion'
import { LogoMark } from '@/brand/Logo'
import SignInPage from '@/features/auth/SignInPage'
import SignUpChooser from '@/features/auth/SignUpChooser'
import StudentSignUp from '@/features/auth/StudentSignUp'
import TeacherSignUp from '@/features/auth/TeacherSignUp'
import ClassPage from '@/features/classes/ClassPage'
import ClassesPage from '@/features/classes/ClassesPage'
import JoinPage from '@/features/classes/JoinPage'
import { NotificationsProvider } from '@/features/notifications/NotificationsProvider'
import { AppShell } from '@/features/shell/AppShell'
import { ToastProvider } from '@/components/ui/Toast'
import type { Capabilities } from '@/lib/user'
import Chat from '@/pages/Chat'
import Profile from '@/pages/Profile'
import Admin from '@/pages/Admin'
import Shared from '@/pages/Shared'
import SharedArtifact from '@/pages/SharedArtifact'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
      <PreferencesProvider>
      <MotionProvider>
      <ToastProvider>
      <NotificationsProvider>
        <Routes>
          <Route path="/signin" element={<PublicOnly><SignInPage /></PublicOnly>} />
          <Route path="/signup" element={<PublicOnly><SignUpChooser /></PublicOnly>} />
          <Route path="/signup/teacher" element={<PublicOnly><TeacherSignUp /></PublicOnly>} />
          <Route path="/signup/student" element={<PublicOnly><StudentSignUp /></PublicOnly>} />
          {/* Deliberately outside Protected: needing an account to read a
              shared link would defeat the entire feature. */}
          <Route path="/s/:token" element={<Shared />} />
          <Route path="/a/:token" element={<SharedArtifact />} />
          <Route path="/" element={<Protected><Chat /></Protected>} />
          <Route path="/c/:conversationId" element={<Protected><Chat /></Protected>} />
          {/* Signed in or out: the page decides what an invite means for you. */}
          <Route path="/join/:key" element={<JoinPage />} />
          <Route path="/classes" element={<Shell><ClassesPage /></Shell>} />
          <Route path="/classes/:classId" element={<Shell capability="manage_classes"><ClassPage /></Shell>} />
          <Route path="/classes/:classId/:tab" element={<Shell capability="manage_classes"><ClassPage /></Shell>} />
          <Route path="/profile" element={<Shell><Profile /></Shell>} />
          <Route path="/settings" element={<Shell><Settings /></Shell>} />
          <Route path="/admin" element={<Shell capability="manage_users"><Admin /></Shell>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationsProvider>
      </ToastProvider>
      </MotionProvider>
      </PreferencesProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

/** Blocks render until the session is known, so routes do not flash. */
function Gate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth()
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <LogoMark twinkle className="size-14 animate-pulse" />
      </div>
    )
  }
  return <>{children}</>
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Gate>{children}</Gate>
  if (!user) {
    // Remember where they were headed so sign-in can send them back.
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Gate>{children}</Gate>
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

/**
 * A signed-in page inside the app frame. `capability` sends someone without it
 * home — the server refuses them either way; this just avoids a page of
 * refusals for someone who followed an old link.
 */
function Shell({ children, capability }: { children: React.ReactNode; capability?: keyof Capabilities }) {
  return (
    <Protected>
      <Allowed capability={capability}>
        <AppShell>{children}</AppShell>
      </Allowed>
    </Protected>
  )
}

function Allowed({ children, capability }: { children: React.ReactNode; capability?: keyof Capabilities }) {
  const { user } = useAuth()
  if (capability && !user?.capabilities[capability]) return <Navigate to="/" replace />
  return <>{children}</>
}
