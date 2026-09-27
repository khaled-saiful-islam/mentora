/**
 * What the first-visit tour says, for each kind of account: a few steps, each
 * one thing the person can do here and where to find it. A step for
 * something an account cannot do (a live lesson where live lessons are off)
 * is left out, so the tour never points at a door that isn't there.
 */
import {
  Barbell,
  Books,
  Broadcast,
  ChartLineUp,
  ChatsCircle,
  HandWaving,
  House,
  Medal,
  RocketLaunch,
  ShareNetwork,
  Sparkle,
  UserPlus,
  UsersThree,
  type Icon,
} from '@phosphor-icons/react'
import { profileOf } from '@/features/buddies'
import { can, firstName, type User } from '@/lib/user'

export interface TourStep {
  key: string
  title: string
  body: string
  /** The picture: a big icon, or the student's own buddy. */
  Icon: Icon
  buddy?: 'wave' | 'celebrate'
  /** Where in the app this lives, said plainly: "Home", "Library". */
  where?: string
  /** Theme colour family for the picture. */
  tone: 'grape' | 'sky' | 'sun' | 'mint' | 'coral'
}

function student(user: User): TourStep[] {
  const buddy = profileOf(user.buddy).name
  const steps: (TourStep | false)[] = [
    { key: 'hello', title: `Hi ${firstName(user)}! I'm ${buddy}.`, body: "I'll be right here while you learn. Let me show you around — it's quick!", Icon: HandWaving, buddy: 'wave', tone: 'grape' },
    { key: 'todo', title: 'Your to-do', body: 'Quizzes, flashcards and study guides from your teachers land here. Tap one to start.', Icon: House, where: 'Home', tone: 'sky' },
    { key: 'practice', title: 'Practice made for you', body: "After a quiz, practice appears for the skills that were tricky. So do the ones your family sends.", Icon: Barbell, where: 'Practice', tone: 'mint' },
    { key: 'results', title: 'Watch yourself grow', body: "See your stars, the skills you've got, and what to practise next. Collect badges as you go!", Icon: Medal, where: 'Results and Badges', tone: 'sun' },
    can(user, 'join_live_sessions') && { key: 'live', title: 'Live lessons', body: 'When your teacher plans one, Astra teaches it out loud — and you can raise your hand to ask.', Icon: Broadcast, where: 'Schedule', tone: 'coral' },
    { key: 'go', title: "You're all set!", body: `Tap ${buddy} any time for a trick. Let's learn something amazing!`, Icon: RocketLaunch, buddy: 'celebrate', tone: 'grape' },
  ]
  return steps.filter((s): s is TourStep => Boolean(s))
}

function teacher(user: User): TourStep[] {
  const steps: (TourStep | false)[] = [
    { key: 'hello', title: `Welcome, ${firstName(user)}!`, body: 'Make lessons in minutes, share them with your classes, and see exactly how everyone is doing.', Icon: Sparkle, tone: 'grape' },
    can(user, 'manage_classes') && { key: 'classes', title: 'Start a class', body: 'Create a class and share its code or link. Students join in seconds.', Icon: UsersThree, where: 'Classes', tone: 'sky' },
    can(user, 'share_learning_sets') && { key: 'make', title: 'Make quizzes, flashcards and study guides', body: 'From a topic, your own materials, or a photo of a page. Press Preview to play it as a student would.', Icon: Books, where: 'Library', tone: 'sun' },
    can(user, 'share_learning_sets') && { key: 'share', title: 'Share, then see results', body: 'Share with a class and a due date. Results show every answer, the hardest questions and a skill map.', Icon: ChartLineUp, where: 'Classes → Shared', tone: 'mint' },
    can(user, 'run_live_sessions') && { key: 'live', title: 'Live lessons with Astra', body: 'Plan a lesson and Astra teaches it out loud, taking your students’ questions as they go.', Icon: Broadcast, where: 'Live lessons', tone: 'coral' },
  ]
  return steps.filter((s): s is TourStep => Boolean(s))
}

function parent(user: User): TourStep[] {
  const steps: (TourStep | false)[] = [
    { key: 'hello', title: `Welcome, ${firstName(user)}!`, body: "Follow your child's learning and help them at home — a few minutes a day goes a long way.", Icon: HandWaving, tone: 'grape' },
    can(user, 'see_children') && { key: 'link', title: 'Connect your child', body: 'On their Mentora, your child opens Settings → My family and reads you a 6-letter code. Type it on Home.', Icon: UserPlus, where: 'Home', tone: 'sky' },
    can(user, 'see_children') && { key: 'follow', title: "See how they're doing", body: "Their results, the skills they're working on, what's due — and a note if something is late.", Icon: ChartLineUp, where: 'Home → your child', tone: 'mint' },
    can(user, 'make_family_sets') && { key: 'send', title: 'Send practice home', body: 'Make a quiz or flashcards — even from a photo of their homework — and send it to your child.', Icon: ShareNetwork, where: 'Library', tone: 'sun' },
    can(user, 'use_chat') && { key: 'ask', title: 'Ask for ideas', body: 'Chat knows how your child is doing and suggests simple ways to help.', Icon: ChatsCircle, where: 'Chat', tone: 'coral' },
  ]
  return steps.filter((s): s is TourStep => Boolean(s))
}

/** The tour for this person; empty when there is none for their role. */
export function tourFor(user: User | null): TourStep[] {
  if (!user) return []
  if (user.role === 'student') return student(user)
  if (user.role === 'parent') return parent(user)
  if (user.role === 'teacher') return teacher(user)
  return []
}
