# 035 — The studio's front page and the Create menu

## What it does

**An empty studio** (a teacher's new chat) is a page with room to breathe:

- a greeting, and a headline whose last word keeps changing — "Let's make a
  *quiz*… *study guide*… *poster*…" — each in its kind's colour;
- **the box in the middle of the page**, inside a slowly turning ring of the
  brand's colours. When the first message is sent it glides down to its usual
  place at the foot of the conversation (a shared `layoutId`);
- four ideas as small chips under the box — a short label, the full request
  sent;
- **Create something** — one panel, two tabs: **Learning** (quizzes,
  flashcards, study guides) and **Studio** (posters, slides, websites, apps,
  games). Only one group shows at a time, so eight cards never crowd the page.
  Every card plays its little scene all the time. A light moves from card to
  card, turning the lit one to its next example; pointing at a card takes the
  light.
  Choosing a learning kind opens its maker with the example as the topic;
  choosing a studio kind writes its request into the box with the subject
  selected, ready to change or send.

**In a conversation** the box keeps a clean toolbar — *Attach*, *Search*,
*Create*. *Create* opens a menu of the same things, grouped the same way, in
place of the two rows of chips that used to sit over the box.

An artifact in the transcript is a card that wears its kind — its colour and
its moving scene — with the whole title, what it is, its version, and a plain
*Open* (or *Showing*) button; while it is being made, a stripe of its colour
runs along a track under the current step.

## How it works

- `components/make/creatables.tsx` builds one list from the two registries
  the browser already has (`useMakeable`): the learning kinds and the studio
  kinds, each with a short line (`BLURBS`), examples, its icon, colour and
  scene. `CreatePanel` and `CreateMenu` both read it, so they cannot disagree.
- `Composer` has a `variant` — `dock` (sticky at the foot) or `hero` (the big
  box in the middle, `.composer-glow`) — and a `tools` slot for the toolbar.
  `pages/Chat.tsx` renders the hero box inside `ChatWelcome` on an empty
  studio and the docked one everywhere else.
- `LearnStudio.create(kind, topic?)` opens the learning maker with a topic.

## Configuration

None.

## Extending it

- **A new studio kind** appears in the Studio tab and the menu by existing;
  give it a line in `BLURBS`, a scene in `Scene.tsx` and examples in
  `showcase.ts`.
- **A new learning kind** likewise; add its examples to `LEARNING_EXAMPLES`
  and its scene to `features/learning/scenes.tsx`.

## Known limits

- **The turning ring uses `@property`**, so a browser without it shows the
  ring still — the same colours, not moving.
- **The glide from the middle to the foot** is a layout animation between two
  mounts of the box; what was typed is not carried across, because sending is
  what triggers it and sending empties the box.
- **Students do not see any of this** while their chat is closed
  (`025-roles-and-signup.md`).
