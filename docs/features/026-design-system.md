# 026 — Design system: theme, type, motion, text size

## What it does

One Mentora look for everyone, in a light and a dark variant:

| Token family | Use |
|---|---|
| **Grape** (`--grape-*`, brand `#6D4AFF`) | Primary actions, focus, selection |
| **Sunshine** (`--sun-*`) | Stars, streaks, the celebratory button |
| **Mint / Coral** (`--correct`, `--wrong`) | Right and "try again" — fills are vivid, text on them is ink |
| **Sky** (`--info`) | Information |
| **Kinds** (`--kind-x`, `--kind-x-vivid`) | Quiz = tangerine, Flashcard = lagoon, Poster = rose, Slides = blue, Game = orchid, Website = lime, App = leaf. `--kind-x` is text-safe; `-vivid` is the fill |

- **Type**, self-hosted through Fontsource — never fetched from a font CDN,
  so nothing about a child's visit leaves for a third party:
  - **Fredoka** for headings
  - **Nunito** for body text
  - **Lilita One** for celebrations
  - **Andika** for the *Easy read* style
- **Text size** has five steps: 90, 100, 115, 130 and 150%. Students start at
  115% and staff at 100%. The control (`TextSizeControl`) sits in settings, and
  later in the artifact panel and the players. It is one setting, saved to the
  account.
- **Motion** uses `motion` (Framer Motion's successor) with one set of springs
  (`motion/presets.ts`: `snappy`, `bouncy`, `gentle`, `lazy`) and shared
  variants (`rise`, `pop`, `page`, `wobble`).
- **The logo** is an open book whose page tops draw an "M", with a sunshine
  spark over it. It appears as `LogoMark` (inline, `currentColor`), as
  `LogoTile` (the app icon), in `public/mentora.svg`, and as PWA icons.

## How it works

- `theme.css` holds every colour as a bare HSL triplet, so `hsl(var(--x) / .2)`
  works. The dark values appear twice — under the media query and under
  `[data-theme="dark"]` — which is what lets an explicit choice beat the OS in
  both directions.
- **Text scale without layout blow-up.**
  - Tailwind's `--text-*` sizes are redefined in `@theme inline` as
    `calc(size * var(--text-scale))`.
  - `inline` puts the calc into each utility, so the scale is read where the
    text is, and a container can set its own.
  - Spacing is not scaled, so bigger text does not balloon the layout.
- **No flash on load.** A tiny script in `index.html` applies the last theme,
  text size and font style before first paint. `/auth/me` then confirms them.
- **Reduced motion is one switch.** `<MotionConfig reducedMotion>` follows the
  person's setting (`Auto` → the system, `Calm` → always still, `Lively` →
  never). `index.css` stills every CSS animation for `data-motion="reduced"`,
  and for the system setting unless the person chose Lively.
  `useCalmMotion()` is for JS-driven motion (confetti, timers).
- **Contrast is tested.** `styles/theme.test.ts` reads `theme.css` and asserts
  AA (4.5:1) for every text/ground pairing the app uses, in both themes — 52
  pairings, including every kind colour on every surface.

## Configuration

None. The look is code: edit `theme.css`.

## Extending it

- **A new kind colour**: add `--kind-x` and `--kind-x-vivid` to `:root`, then
  `--kind-x` to both dark blocks, then the `@theme inline` mappings, then the
  kind to `KINDS` in `theme.test.ts`.
- **A new spring or variant**: add it to `motion/presets.ts`. Components never
  invent their own timings.
- **A new font style**: add a `:root[data-font="x"]` block, the value to
  `FONT_STYLES` in `services/preferences.py` and to `FontStyle` in `lib/user.ts`.

## Known limits

- **Arbitrary pixel text sizes do not scale.** `text-[13px]` in older
  components ignores the text-size setting until each screen is restyled.
- **`lucide-react` is still used by older screens.** Phosphor is the icon set
  going forward; the restyle phase removes lucide.
- **The Easy read face (Andika) has no variable axis.** Only weights 400 and 700
  are shipped, so semibold text renders as one of them.
