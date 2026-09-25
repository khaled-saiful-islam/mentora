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
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="/admin" element={<Protected><AdminOnly><Admin /></AdminOnly></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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

/** The server refuses non-admins either way; this just avoids showing a page
 *  of refusals to someone who followed an old link. */
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user?.capabilities.manage_users) return <Navigate to="/" replace />
  return <>{children}</>
}

