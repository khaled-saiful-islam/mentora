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
  /** When a child has been on one question a while: take your time. */
  nudge: string[]
  halfway: string[]
  /** As the last question or card appears. */
  last: string[]
  /** Right, straight after a miss. */
  comeback: string[]
  /** Two misses in a row: a kind word before a strategy tip. */
  tough: string[]
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
    nudge: ['Take your time. Clever kancil think first!', 'Read it once more, slowly. You can do it!', 'No rush! Sang Kancil always thinks it through.'],
    halfway: ['Halfway there! Zip zip!', 'Half done already. So quick!'],
    last: ['Last one! Make it clever!', 'Final one. Let\'s zip through it!'],
    comeback: ['See? You bounced right back!', 'Zip! Back on track!'],
    tough: ['Tricky ones, huh? Here\'s a kancil trick:', 'Two sneaky ones! Let\'s try a trick:'],
    secret: 'You found my secret dance! Shh!',
    sleepy: 'Zzz... five more minutes...',
  },
  tompok: {
    hello: ['Meow! Ready to learn something purr-fect?', "Purr... I've been waiting for you!", "Let's pounce on some learning!"],
    tap: ['Purrrr... that tickles!', 'Watch me chase my tail!', 'Did you know cats can sleep 16 hours a day?', 'My bell jingles when I am happy!'],
    correct: ['Purr-fect!', 'Meow-velous!', 'Paws-itively right!', 'Clever kitty move!'],
    wrong: ['Even cats land on the wrong paw sometimes. Next one!', 'Shake it off, like a cat after a bath!', "Hmm, tricky! Let's pounce on the next."],
    streak: ['{n} in a row! A purr-fect streak!', '{n} straight! My whiskers are twitching!'],
    knew: ['You knew it! Purr!', 'Tucked away, like a cat in a box!'],
    notYet: ["We'll chase that one again.", "Round two — we'll catch it!"],
    finish: {
      great: ["Purr-fect! You're the cat's whiskers!", 'Meow-nificent! What a star!'],
      good: ["Nice work! A little more practice and you'll be purr-fect.", 'Great job! My tail is swishing with pride.'],
      keep: ['Every try makes you stronger. Paws up!', "You finished — that's something to purr about!"],
    },
    nudge: ['Take your time. Cats watch carefully before they pounce.', 'Read it once more, slowly. Purr...', 'No rush — curious cats think it through.'],
    halfway: ['Halfway there! Meow!', 'Half done — tail up, keep going!'],
    last: ['Last one! Pounce on it!', 'Final one — land it on your paws!'],
    comeback: ['Right back on your paws!', 'Purr! What a comeback!'],
    tough: ["Tricky ones, huh? Here's a cat trick:", 'Two sneaky ones. Try this:'],
    secret: 'You found my secret kitty dance!',
    sleepy: 'Cat nap time... zzz...',
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
    nudge: ['Take your time. Wise owls think slowly.', 'Read it once more. What is it really asking?', 'Hoo, no hurry at all.'],
    halfway: ['Halfway there. Well done so far!', 'Half the way! Keep going, wise one.'],
    last: ['The last one. Think it through!', 'Final question. You\'re nearly there!'],
    comeback: ['There you go! Wise indeed.', 'Hoo! Right back on track.'],
    tough: ['Tricky ones happen. Here\'s an owl trick:', 'Hoo, two tough ones. Try this:'],
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
    nudge: ['Take a big breath, like a baby dragon. Puff!', 'Read it once more. Slowly does it!', 'No rush. Dragons are patient!'],
    halfway: ['Halfway there! Puff puff!', 'Half your treasure found!'],
    last: ['Last one! Make it sparkle!', 'Final one. Fire up!'],
    comeback: ['Puff! Right back on track!', 'Sparkle! You bounced back!'],
    tough: ['Sneaky ones! Here\'s a dragon trick:', 'Two tricky ones. Try this:'],
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
    nudge: ['Take your time. Tigers wait before they pounce!', 'Read it once more, slowly. Rawr!', 'No rush, champ. Think it through.'],
    halfway: ['Halfway there! Rawr!', 'Half done! Stay strong!'],
    last: ['Last one! Pounce on it!', 'Final one, champ. You\'ve got this!'],
    comeback: ['That\'s the tiger spirit! Back on track!', 'Rawr! What a comeback!'],
    tough: ['Tough ones? Tigers keep going. Try this:', 'Two tricky ones. Here\'s a tiger trick:'],
    secret: 'You found my secret tiger dance!',
    sleepy: 'Big cats nap a lot... zzz...',
  },
}

export function pick<T>(lines: readonly T[], seed: number = Math.random()): T {
  return lines[Math.floor(Math.abs(seed) * lines.length) % lines.length]
}
