/**
 * How to play each template (§26.8), in three steps — the app's own words,
 * like its buttons, in the game's language. Shown with an animated demo
 * (`demos.tsx`) before a template is first played, and on asking.
 */
import type { Play } from '../types'

export type HowToLanguage = 'en' | 'ms'

export const HOW_TO: Record<Play, Record<HowToLanguage, [string, string, string]>> = {
  sort: {
    en: ['Look at the card.', 'Tap the basket it belongs in — or drag it there.', 'Wrong basket? Your buddy says why. Try again!'],
    ms: ['Lihat kad itu.', 'Ketik bakul yang betul — atau seret ke sana.', 'Bakul salah? Kawanmu beritahu sebabnya. Cuba lagi!'],
  },
  order: {
    en: ['Find what comes first.', 'Tap it to put it in the line.', 'Keep going until every step is in place.'],
    ms: ['Cari apa yang berlaku dahulu.', 'Ketik untuk letak dalam barisan.', 'Teruskan sehingga semua langkah tersusun.'],
  },
  match: {
    en: ['Pick an answer from the tray.', 'Drop it in the slot beside its partner — or tap the slot.', 'Green means it is right!'],
    ms: ['Pilih jawapan dari dulang.', 'Letak di petak sebelah pasangannya — atau ketik petak itu.', 'Hijau bermakna betul!'],
  },
  lab: {
    en: ['Read the goal.', 'Slide the controls and watch the meter.', 'Keep it in the green zone to reach the goal.'],
    ms: ['Baca matlamat.', 'Gerakkan peluncur dan lihat meter.', 'Kekalkan dalam zon hijau untuk capai matlamat.'],
  },
  mistake: {
    en: ['Read every line.', 'Tap the line that is wrong.', 'Pick the right fix.'],
    ms: ['Baca setiap baris.', 'Ketik baris yang salah.', 'Pilih pembetulan yang betul.'],
  },
  case: {
    en: ['Open the clue cards and read them.', 'Pick who — or what — it is.', 'Then pick the clue that proves it.'],
    ms: ['Buka kad petunjuk dan baca.', 'Pilih siapa — atau apa — jawapannya.', 'Kemudian pilih petunjuk yang membuktikannya.'],
  },
  escape: {
    en: ['Read the puzzle on the door.', 'Enter the code: numbers, letters or a symbol.', 'Open every door to escape!'],
    ms: ['Baca teka-teki di pintu.', 'Masukkan kod: nombor, huruf atau simbol.', 'Buka semua pintu untuk keluar!'],
  },
  say: {
    en: ['Tap Listen to hear the words.', 'Tap the microphone and read them out loud.', 'Each word you say turns green!'],
    ms: ['Ketik Dengar untuk mendengar perkataan.', 'Ketik mikrofon dan baca dengan kuat.', 'Setiap perkataan yang kamu sebut jadi hijau!'],
  },
  boss: {
    en: ["Read the boss's question.", 'Tap the right answer to hit the boss.', 'A wrong one costs a heart — and the question comes back.'],
    ms: ['Baca soalan bos.', 'Ketik jawapan betul untuk serang bos.', 'Jawapan salah hilang satu hati — dan soalan itu kembali.'],
  },
}

export const STUCK: Record<HowToLanguage, string> = {
  en: 'Stuck? Ask for a hint, or press Show me.',
  ms: 'Buntu? Minta petunjuk, atau tekan Show me.',
}

export const TITLE: Record<HowToLanguage, string> = { en: 'How to play', ms: 'Cara bermain' }

export const languageOf = (language: string): HowToLanguage => (language === 'ms' ? 'ms' : 'en')
