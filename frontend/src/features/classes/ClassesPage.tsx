import { useAuth } from '@/lib/auth'
import { can } from '@/lib/user'
import StudentClassesPage from './StudentClassesPage'
import TeacherClassesPage from './TeacherClassesPage'

/** One address, two pages: a teacher runs classes, a student is in them. */
export default function ClassesPage() {
  const { user } = useAuth()
  return can(user, 'manage_classes') ? <TeacherClassesPage /> : <StudentClassesPage />
}
