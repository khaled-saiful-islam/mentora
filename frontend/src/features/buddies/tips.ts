/**
 * Tips a buddy gives between questions and on the home screen.
 *
 * A tip is about *how* to learn — reading carefully, ruling out, taking a
 * breath — or a nudge towards a skill the student could practise. Nothing
 * here is given a question, so a tip can never hint at an answer.
 */

export type TipPlace = 'home' | 'quiz' | 'flashcard' | 'guide' | 'results'

export const TIPS: Record<TipPlace, readonly string[]> = {
  home: [
    'A little practice every day beats one giant session.',
    'Teach a friend what you learned — it sticks better!',
    'Drink some water. Brains love water!',
    'Mistakes show you exactly what to learn next.',
    'Take a short break every 20 minutes. Stretch like me!',
  ],
  quiz: [
    'Read the whole question before you pick.',
    'Stuck? Rule out the answers you know are wrong.',
    'Try to answer in your head before you look at the choices.',
    'Take a deep breath. Slow and steady wins!',
    'Watch out for words like NOT and ALWAYS.',
  ],
  flashcard: [
    'Say the answer out loud before you flip.',
    'Be honest with "Not yet" — those cards come back in round two.',
    'Picture the answer in your mind first.',
    'Try making a silly story to remember a tricky card.',
  ],
  guide: [
    'Tap a dotted word to see what it means!',
    'Like listening? Press "Read it to me".',
    'Too tricky? Try Simpler — same ideas, easier words.',
    'Feeling brave? Switch to Challenge!',
    'Look at the picture first — it tells half the story.',
  ],
  results: [
    'Look at what you missed — that is where the learning is.',
    'Try a practice set on your trickiest skill.',
    'Come back tomorrow and see how much you remember!',
  ],
}

export interface SkillNudges {
  practise?: readonly string[]
  strengths?: readonly string[]
}

/** A tip for the place, sometimes swapped for a nudge about the student's
 *  own skills. `seed` makes it repeatable in a test. */
export function tipFor(place: TipPlace, skills: SkillNudges = {}, seed: number = Math.random()): string {
  const nudges = [
    ...(skills.practise ?? []).map((s) => `Let's get stronger at ${s} — a practice set would help!`),
    ...(skills.strengths ?? []).map((s) => `You're a star at ${s}! Keep it shining.`),
  ]
  const pool = place === 'home' || place === 'results' ? [...nudges, ...nudges, ...TIPS[place]] : TIPS[place]
  return pool[Math.floor(Math.abs(seed) * pool.length) % pool.length]
}

/** Hello in Malay, by the time of day. */
export function greeting(now: Date = new Date()): string {
  const hour = now.getHours()
  if (hour >= 5 && hour < 11) return 'Selamat pagi'
  if (hour >= 11 && hour < 14) return 'Selamat tengah hari'
  if (hour >= 14 && hour < 19) return 'Selamat petang'
  return 'Selamat malam'
}
