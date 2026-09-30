/**
 * What the buddy says on each page, from what it knows about the student
 * (`brief.ts`). Pure, and tested.
 *
 * On every page it is the same friend: it knows what is waiting and when it
 * is due, how the student has been doing, what they are strong at and what
 * needs practice, and when the next live lesson is — and it says the useful
 * part for the page they are on, with a tip for doing better at quizzes,
 * flashcards, study guides and live lessons.
 *
 * Like every buddy line, none of it is about a question's content, so it
 * can never give an answer away.
 */
import { whenLabel } from '@/features/live/sessions/when'
import type { BriefKind, BuddyBrief, KindRecord } from './brief'
import { pick } from './voices'

export type Place = 'home' | 'practice' | 'results' | 'badges' | 'schedule' | 'room' | 'classes' | 'leaderboard' | 'buddy' | 'other'

export function placeOf(pathname: string): Place {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/room/')) return 'room'
  const first = pathname.split('/')[1]
  const known: Record<string, Place> = {
    practice: 'practice',
    results: 'results',
    badges: 'badges',
    schedule: 'schedule',
    classes: 'classes',
    leaderboard: 'leaderboard',
    buddy: 'buddy',
  }
  return known[first] ?? 'other'
}

export type Activity = BriefKind | 'live'

/** How to do better at each thing, the way a friend who has done it would say. */
export const HOW_TO: Record<Activity, readonly string[]> = {
  quiz: [
    'Read the whole question, then every answer, before you choose.',
    'Rule out the answers you know are wrong, then pick from what is left.',
    'Look for small words like NOT or ALWAYS. They change the question!',
    'Stuck? Take a slow breath and read it once more.',
  ],
  flashcard: [
    'Say your answer out loud before you flip the card.',
    'Be honest with "Not yet". Those cards come back so you can learn them.',
    'Picture the answer in your head, like a little movie.',
  ],
  study_guide: [
    'Try "Read it to me" and follow the words as they light up.',
    'Tap the dotted words to see what they mean.',
    'Pick "Simpler" if it feels hard. You can switch any time.',
    'Read the Remember box twice before the check.',
  ],
  live: [
    'Sit somewhere quiet and turn your sound on.',
    'Have a question? Type it in "Ask Astra" at any time.',
    'Watch the key idea on the screen. It is the big thing to remember.',
    'When a quick check pops up, read every option first.',
  ],
}

const KIND_WORDS: Record<BriefKind, string> = { quiz: 'quizzes', flashcard: 'flashcards', study_guide: 'study guides' }
const GOING_WELL = 85
const FEELS_HARD = 60

/** How one kind has gone lately: praise when it goes well, a tip when it is hard. */
export function kindLine(record: KindRecord, seed = Math.random()): string {
  const words = KIND_WORDS[record.kind]
  const tip = pick(HOW_TO[record.kind], seed)
  const average = Math.round(record.average)
  if (record.average >= GOING_WELL) return `Your ${words} are going brilliantly lately: ${average}% on average!`
  if (record.average < FEELS_HARD) return `${capital(words)} have felt tricky lately. Try this: ${tip}`
  return `${capital(words)} tip: ${tip}`
}

/** The lines worth saying on a page, most useful first. */
export function linesFor(place: Place, brief: BuddyBrief, now: Date = new Date(), seed = Math.random()): string[] {
  const lines = (() => {
    switch (place) {
      case 'practice':
        return [
          brief.practise[0] && `Let's practise "${brief.practise[0]}". A round on it will help it stick.`,
          ...brief.kinds.filter((k) => k.average < FEELS_HARD).map((k) => kindLine(k, seed)),
          `Practice tip: ${pick(HOW_TO.quiz, seed)}`,
        ]
      case 'results':
        return [
          recentLine(brief),
          brief.strengths[0] && `You're really strong at "${brief.strengths[0]}"!`,
          brief.practise[0] && `"${brief.practise[0]}" needs a bit more practice. You'll find some under Practice.`,
          ...brief.kinds.map((k) => kindLine(k, seed)),
        ]
      case 'badges':
        return [
          brief.badges > 0 && `You've earned ${brief.badges} ${brief.badges === 1 ? 'badge' : 'badges'}. I'm so proud of you!`,
          brief.streak >= 2 && `${brief.streak} days in a row! One more day keeps your streak going.`,
          ...waitingLines(brief, now),
        ]
      case 'schedule':
        return [lessonLine(brief, now), `Live lesson tip: ${pick(HOW_TO.live, seed)}`, ...waitingLines(brief, now)]
      case 'room':
        return turned(HOW_TO.live, seed).slice(0, 2).map((tip) => `Tip: ${tip}`)
      case 'leaderboard':
        return ['The board is fun, but beating your own best is what counts!', ...brief.kinds.filter((k) => k.kind === 'quiz').map((k) => kindLine(k, seed))]
      case 'home':
      case 'buddy':
        return []
      default:
        return [...waitingLines(brief, now), lessonLine(brief, now), brief.streak >= 2 && `${brief.streak} days in a row! Let's keep it going.`]
    }
  })()
  return lines.filter((line): line is string => typeof line === 'string' && line.length > 0)
}

/**
 * For the home page's own buddy, on top of what home already shows: what is
 * overdue, the next live lesson, and how each kind of set has gone lately.
 */
export function homeLines(brief: BuddyBrief | null, now: Date = new Date(), seed = Math.random()): string[] {
  if (!brief) return []
  const late = brief.waiting.find((w) => w.overdue)
  return [
    late && `"${late.title}" is overdue. Shall we do it now? I'll help!`,
    lessonLine(brief, now),
    ...brief.kinds.map((k) => kindLine(k, seed)),
  ].filter((line): line is string => typeof line === 'string' && line.length > 0)
}

/** Which tips fit a kind of set. */
export function activityOf(kind: string): BriefKind {
  return kind === 'flashcard' ? 'flashcard' : kind === 'study_guide' ? 'study_guide' : 'quiz'
}

/**
 * As a quiz, deck or guide starts: what the buddy knows about this student
 * and these skills — a skill that was tricky before, one they are strong
 * at, or how this kind has gone lately. Null when it knows nothing useful.
 */
export function playTip(kind: string, skills: readonly string[], brief: BuddyBrief | null, seed = Math.random()): string | null {
  if (!brief) return null
  const hard = skills.find((s) => brief.practise.includes(s))
  if (hard) return `This one has "${hard}" in it. It was tricky before, so take it slowly. You can do it!`
  const strong = skills.find((s) => brief.strengths.includes(s))
  if (strong) return `"${strong}"? You're great at this! Show me what you know.`
  const record = brief.kinds.find((k) => k.kind === activityOf(kind))
  return record && record.average < FEELS_HARD ? kindLine(record, seed) : null
}

/** After a finish: the skill to practise next, or a tip for next time. */
export function finishTip(kind: string, skills: readonly { label: string; correct: number; total: number }[], stars: number, seed = Math.random()): string | null {
  const weakest = [...skills].filter((s) => s.total > 0 && s.correct / s.total < 0.6).sort((a, b) => a.correct / a.total - b.correct / b.total)[0]
  if (weakest) return `Next, let's practise "${weakest.label}". A little more and it will stick!`
  if (stars >= 3) return null
  return `Tip for next time: ${pick(HOW_TO[activityOf(kind)], seed)}`
}

function waitingLines(brief: BuddyBrief, now: Date): (string | false)[] {
  const late = brief.waiting.find((w) => w.overdue)
  const soon = brief.waiting.find((w) => !w.overdue && w.due_at)
  return [
    late !== undefined && `"${late.title}" is overdue. Shall we do it now? I'll help!`,
    brief.due_soon > 0 && soon?.due_at != null && `"${soon.title}" is due ${spoken(soon.due_at, now)}. You've got this!`,
    !late && !soon && brief.waiting_count > 0 && `You have ${brief.waiting_count} ${brief.waiting_count === 1 ? 'thing' : 'things'} waiting, starting with "${brief.waiting[0].title}".`,
  ]
}

function lessonLine(brief: BuddyBrief, now: Date): string | false {
  const next = brief.next_lesson
  if (!next) return false
  if (next.status === 'live' || next.status === 'lobby') return `Your live lesson "${next.title}" is on now! Head to Schedule to join.`
  return next.scheduled_at !== null && `Your live lesson "${next.title}" is ${spoken(next.scheduled_at, now)}. I can't wait!`
}

function recentLine(brief: BuddyBrief): string | false {
  const last = brief.recent[0]
  if (!last) return false
  const percent = Math.round(last.percent)
  if (percent >= GOING_WELL) return `${percent}% on "${last.title}"! That's brilliant.`
  if (percent >= FEELS_HARD) return `${percent}% on "${last.title}". Nice work! A little practice will push it higher.`
  return `"${last.title}" was a tricky one. Let's practise it together, and it'll get easier.`
}

/** "today at 3:00 PM", "tomorrow at 9:00 AM", or "on Thu, 2 Oct, 9:00 AM". */
export function spoken(iso: string, now: Date): string {
  const label = whenLabel(iso, now)
  const near = /^(Today|Tomorrow), (.*)$/.exec(label)
  return near ? `${near[1].toLowerCase()} at ${near[2]}` : `on ${label}`
}

/** The list started from a place picked by `seed`, so pages vary. */
function turned<T>(list: readonly T[], seed: number): T[] {
  const at = Math.floor(seed * list.length) % list.length
  return [...list.slice(at), ...list.slice(0, at)]
}

function capital(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}
