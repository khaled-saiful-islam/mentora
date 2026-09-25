/**
 * What each buddy says, in their own voice. Lines are about the student and
 * how they are doing — never about a question's content, so a buddy can
 * cheer and console but can never give an answer away.
 */
import type { BuddyKey } from './types'

export interface Voice {
  /** Said after "Hi, {name}!" */
  hello: string[]
  tap: string[]
  correct: string[]
  wrong: string[]
  /** `{n}` is how many in a row. */
  streak: string[]
  knew: string[]
  notYet: string[]
  finish: { great: string[]; good: string[]; keep: string[] }
  /** For five quick taps. */
  secret: string
  sleepy: string
}

export const VOICES: Record<BuddyKey, Voice> = {
  kiko: {
    hello: ['Zip zip! Ready to be clever?', 'Let\'s outsmart some questions today!', 'I saved you a spot. Let\'s go!'],
    tap: ['Hehe, that tickles!', 'Watch this backflip!', 'Did you know kancil are the smallest hoofed animals?', 'Sang Kancil would be proud of you!'],
    correct: ['Smart move!', 'You outsmarted that one!', 'Zip! Right on!', 'Clever, clever!'],
    wrong: ['Even Sang Kancil slips sometimes. Next one!', 'Hmm, tricky! You\'ll get the next.', 'That\'s okay. Clever minds learn from misses!'],
    streak: ['{n} in a row! You\'re zipping!', '{n} straight! Too quick for me!'],
    knew: ['You knew it!', 'Zip! Into your brain it goes!'],
    notYet: ['No worries, we\'ll see it again.', 'Round two will get it!'],
    finish: {
      great: ['WOW! That was genius-level clever!', 'Backflips for you! Amazing!'],
      good: ['Nice work! You\'re getting sharper!', 'Clever stuff! A little more practice and you\'ll zoom.'],
      keep: ['Every try makes you cleverer!', 'Tricky one! Practice will make it easy.'],
    },
    secret: 'You found my secret dance! Shh!',
    sleepy: 'Zzz... five more minutes...',
  },
  bolt: {
    hello: ['Beep boop! Brain battery at 100%!', 'Systems online. Learning mode: ON!', 'Bzzt! Ready when you are!'],
    tap: ['Boop! You found my button!', 'Calculating... awesomeness detected!', 'Spin mode activated!', 'My antenna lights up when you learn!'],
    correct: ['Correct! +1 brain power!', 'Beep beep! Nailed it!', 'Answer accepted. You rock!', 'Ding ding ding!'],
    wrong: ['Error? No problem. Rebooting... try the next!', 'Recalculating! You\'ve got this.', 'Bugs happen. Onward!'],
    streak: ['{n} in a row! Overload of awesome!', 'Streak x{n}! My lights can\'t keep up!'],
    knew: ['Data saved to your brain!', 'Beep! Memory locked in.'],
    notYet: ['Queued for round two!', 'We\'ll run that one again.'],
    finish: {
      great: ['MAXIMUM SCORE PROTOCOL! You\'re incredible!', 'My circuits are dancing!'],
      good: ['Solid run! Upgrading your skills...', 'Nice! A few more practice runs to max out.'],
      keep: ['Every run makes you stronger!', 'Learning in progress... keep going!'],
    },
    secret: 'Secret dance mode unlocked! Beep bop boop!',
    sleepy: 'Low power mode... zzz...',
  },
  ollie: {
    hello: ['Hoo-hoo! Let\'s learn something new.', 'Good to see you, wise one!', 'Settle in. Let\'s think together.'],
    tap: ['Hoo! My glasses!', 'Owls can hear a mouse under the snow!', 'Want to see me flutter?', 'A wise owl asks lots of questions.'],
    correct: ['Wise choice!', 'Hoo-ray! Well thought!', 'Exactly right!', 'You really know your stuff!'],
    wrong: ['Mistakes are how we grow wiser.', 'Not quite, and that\'s alright. Keep going!', 'Hoo, a tricky one. Onward!'],
    streak: ['{n} in a row! Wise and wonderful!', 'Hoo-hoo! {n} straight!'],
    knew: ['Wonderful, you knew it!', 'Tucked safely in your memory.'],
    notYet: ['We\'ll come back to that one.', 'Round two is for learning.'],
    finish: {
      great: ['Magnificent! A truly wise performance!', 'Hoo-hoo-HOORAY!'],
      good: ['Well done! Your wisdom is growing.', 'Lovely work. A little practice and you\'ll soar.'],
      keep: ['Every owl starts as an owlet. You are growing!', 'A tricky one. Well done for finishing!'],
    },
    secret: 'Oh my! You found my secret dance!',
    sleepy: 'Owls sleep in the day... zzz...',
  },
  momo: {
    hello: ['Puff! Ready to fire up our brains?', 'Rawr... I mean, hello!', 'My wings are tiny but my brain is big!'],
    tap: ['Hehe! Want to see a tiny flame?', 'Puff puff!', 'One day I\'ll fly. Today I learn!', 'Dragons love shiny facts!'],
    correct: ['Fire! That was hot!', 'Sparkle-tastic!', 'Puff! You got it!', 'Dragon-level smart!'],
    wrong: ['Oops! Even dragons miss. Try the next one!', 'No worries, puff it away!', 'That one\'s sneaky. Keep going!'],
    streak: ['{n} in a row! You\'re on fire!', 'Puff puff! {n} straight!'],
    knew: ['Into the treasure pile!', 'Shiny! You knew it!'],
    notYet: ['We\'ll warm up to it in round two.', 'Back in the pile it goes!'],
    finish: {
      great: ['You\'re a legend! Dragon dance!', 'Sparkles everywhere! Amazing!'],
      good: ['Great flying! Almost a full treasure pile!', 'Nice! A bit more practice and you\'ll soar.'],
      keep: ['Baby dragons grow a little every day. So do you!', 'You finished! That takes courage.'],
    },
    secret: 'You found the secret dragon dance!',
    sleepy: 'So cosy... zzz...',
  },
  rimau: {
    hello: ['Rawr! Let\'s be brave today!', 'Harimau power! Ready?', 'I\'ve been practising my roar!'],
    tap: ['Rawr! Did I scare you? Hehe.', 'Malayan tigers are the pride of Malaysia!', 'Listen to my mighty roar!', 'Stripes on, brain on!'],
    correct: ['Roar-some!', 'Brave and right!', 'Tiger-strong!', 'That\'s the spirit!'],
    wrong: ['Tigers don\'t give up! Next one!', 'Shake it off. You\'re brave!', 'Oops! Pounce on the next one!'],
    streak: ['{n} in a row! RAWR!', '{n} straight! You\'re unstoppable!'],
    knew: ['Pounced on it!', 'Rawr! You knew it!'],
    notYet: ['We\'ll hunt it down in round two!', 'Back for another pounce!'],
    finish: {
      great: ['CHAMPION! The whole jungle heard that!', 'Roar-some! You\'re amazing!'],
      good: ['Strong work! Keep training, champ!', 'Nice! A little more practice and you\'ll be unstoppable.'],
      keep: ['Brave learners keep going. Rawr!', 'You finished. That was brave!'],
    },
    secret: 'You found my secret tiger dance!',
    sleepy: 'Big cats nap a lot... zzz...',
  },
}

export function pick<T>(lines: readonly T[], seed: number = Math.random()): T {
  return lines[Math.floor(Math.abs(seed) * lines.length) % lines.length]
}
