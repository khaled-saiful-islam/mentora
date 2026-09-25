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
import { NewsPop } from '@/features/notifications/NewsPop'
import { NotificationsProvider } from '@/features/notifications/NotificationsProvider'
import EditorPage from '@/features/learning/EditorPage'
import LibraryPage from '@/features/learning/LibraryPage'
import { LearnStudioProvider } from '@/features/learning/LearnStudio'
import { AppShell } from '@/features/shell/AppShell'
import BuddyPage from '@/features/buddies/BuddyPage'
import { Welcome } from '@/features/buddies/Welcome'
import StudentClassPage from '@/features/classes/StudentClassPage'
import StudentHome from '@/features/home/StudentHome'
import TeacherHome from '@/features/home/TeacherHome'
import PlayPage from '@/features/play/PlayPage'
import ResultsPage from '@/features/results/ResultsPage'
import BadgesPage from '@/features/badges/BadgesPage'
import LeaderboardPage from '@/features/results/LeaderboardPage'
import AssignmentResultsPage from '@/features/results/AssignmentResultsPage'
import { ToastProvider } from '@/components/ui/Toast'
import type { Capabilities } from '@/lib/user'
import Chat from '@/pages/Chat'
import Profile from '@/pages/Profile'
import AdminPage from '@/features/admin/AdminPage'
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
      <LearnStudioProvider>
        <Routes>
          <Route path="/signin" element={<PublicOnly><SignInPage /></PublicOnly>} />
          <Route path="/signup" element={<PublicOnly><SignUpChooser /></PublicOnly>} />
          <Route path="/signup/teacher" element={<PublicOnly><TeacherSignUp /></PublicOnly>} />
          <Route path="/signup/student" element={<PublicOnly><StudentSignUp /></PublicOnly>} />
          {/* Deliberately outside Protected: needing an account to read a
              shared link would defeat the entire feature. */}
          <Route path="/s/:token" element={<Shared />} />
          <Route path="/a/:token" element={<SharedArtifact />} />
          <Route path="/" element={<Protected><Home /></Protected>} />
          <Route path="/chat" element={<Protected><Allowed capability="use_chat"><Chat /></Allowed></Protected>} />
          <Route path="/studio" element={<Protected><Allowed capability="studio_artifacts"><Chat /></Allowed></Protected>} />
          <Route path="/c/:conversationId" element={<Protected><Allowed capability="use_chat"><Chat /></Allowed></Protected>} />
          <Route path="/play/:id" element={<Protected><Allowed capability="take_assignments"><PlayPage source="assignment" /></Allowed></Protected>} />
          <Route path="/practice/:id" element={<Protected><Allowed capability="take_assignments"><PlayPage source="practice" /></Allowed></Protected>} />
          <Route path="/attempts/:id" element={<Protected><Allowed capability="take_assignments"><PlayPage source="attempt" /></Allowed></Protected>} />
          <Route path="/results" element={<Shell capability="take_assignments"><ResultsPage /></Shell>} />
          <Route path="/badges" element={<Shell capability="take_assignments"><BadgesPage /></Shell>} />
          <Route path="/leaderboard/:assignmentId" element={<Shell><LeaderboardPage /></Shell>} />
          <Route path="/assignments/:assignmentId" element={<Shell capability="share_learning_sets"><AssignmentResultsPage /></Shell>} />
          {/* Signed in or out: the page decides what an invite means for you. */}
          <Route path="/join/:key" element={<JoinPage />} />
          <Route path="/classes" element={<Shell><ClassesPage /></Shell>} />
          <Route path="/classes/:classId" element={<Shell capability={SEES_CLASSES}><ClassRoute /></Shell>} />
          <Route path="/classes/:classId/:tab" element={<Shell capability="manage_classes"><ClassPage /></Shell>} />
          <Route path="/library" element={<Shell capability={MAKES_SETS}><LibraryPage /></Shell>} />
          <Route path="/library/:setId" element={<Shell capability={MAKES_SETS}><EditorPage /></Shell>} />
          <Route path="/buddy" element={<Shell><BuddyPage /></Shell>} />
          <Route path="/profile" element={<Shell><Profile /></Shell>} />
          <Route path="/settings" element={<Shell><Settings /></Shell>} />
          <Route path="/admin" element={<Shell capability="manage_users"><AdminPage /></Shell>} />
          <Route path="/admin/:tab" element={<Shell capability="manage_users"><AdminPage /></Shell>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <NewsPop />
      </LearnStudioProvider>
      </NotificationsProvider>
      </ToastProvider>
      </MotionProvider>
      </PreferencesProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

/** `/` is home: a student's, with their buddy and their work; a teacher's,
 *  with their classes and what is happening in them. */
function Home() {
  const { user } = useAuth()
  if (user?.role === 'student') {
    // A new student meets their buddy first; everything else can wait.
    if (!user.onboarded) return <Welcome />
    return (
      <AppShell>
        <StudentHome />
      </AppShell>
    )
  }
  return (
    <AppShell>
      <TeacherHome />
    </AppShell>
  )
}

/** A class page: the teacher's workroom, or what a student sees of it. */
function ClassRoute() {
  const { user } = useAuth()
  return user?.capabilities.manage_classes ? <ClassPage /> : <StudentClassPage />
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
const MAKES_SETS: (keyof Capabilities)[] = ['share_learning_sets', 'make_practice_sets']
const SEES_CLASSES: (keyof Capabilities)[] = ['manage_classes', 'join_classes']

type Needs = keyof Capabilities | (keyof Capabilities)[]

function Shell({ children, capability }: { children: React.ReactNode; capability?: Needs }) {
  return (
    <Protected>
      <Allowed capability={capability}>
        <AppShell>{children}</AppShell>
      </Allowed>
    </Protected>
  )
}

function Allowed({ children, capability }: { children: React.ReactNode; capability?: Needs }) {
  const { user } = useAuth()
  const needs = capability === undefined ? [] : Array.isArray(capability) ? capability : [capability]
  if (needs.length > 0 && !needs.some((name) => user?.capabilities[name])) return <Navigate to="/" replace />
  return <>{children}</>
}
