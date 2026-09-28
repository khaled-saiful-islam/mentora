# 046 — The first-visit tour

A short, friendly tour the first time someone arrives: a few steps showing
what they can do here and where to find it. There is one for students, one
for teachers and one for parents.

## What it does

- **It opens once, by itself.** It appears a moment after the first page
  loads, once the account exists. A student sees it after picking their buddy
  (`Welcome`).
- **A few steps, each one thing to do:**

  | Student | Teacher | Parent |
  |---|---|---|
  | Hi from their own buddy, waving | Welcome | Welcome |
  | Your to-do (*Home*) | Start a class (*Classes*) | Connect your child (*Home*) |
  | Practice made for you (*Practice*) | Make quizzes, flashcards, study guides — from a topic, materials or a photo; Preview (*Library*) | See how they're doing (*Home → your child*) |
  | Watch yourself grow (*Results and Badges*) | Share, then see results (*Classes → Shared*) | Send practice home (*Library*) |
  | Live lessons with Astra (*Schedule*) | Live lessons with Astra (*Live lessons*) | Ask for ideas (*Chat*) |
  | You're all set — the buddy celebrates | | |

  Each step says where the thing lives, in a small *📍 Home* tag.
- **Only what the account can do.** A step whose capability is off (live
  lessons, chat, family sets) is left out.
- **Animated, without flicker.** The window pops in. Each step's words
  slide and fade in while the last step's fade out. All the steps' words
  sit in one grid cell, so the window is as tall as the longest step and
  never jumps. Sideways overflow is clipped, so no scrollbar flickers in. The
  picture's colour cross-dissolves, and its icon pops in over the last. The
  picture floats: a big icon with drifting dots, or, for a student, their own
  buddy waving on the first step and celebrating on the last. Confetti comes at *Let's go!*. Calm motion keeps
  the words and drops the movement.
- **Easy to leave.** *Skip* on the first step, *Back* after that, the close
  button, Escape, or a tap outside. Tab stays inside while it is open, and
  focus returns to where it was.
- **Once seen, it stays away.** Finishing or closing it records `toured_at`.
  *Settings → The tour → Show me around* opens it again at any time.

## How it works

```
db/models/user.py            users.toured_at (null: not yet seen)
POST /api/auth/me/toured     sets it; idempotent
UserResponse.toured          true once set
features/onboarding/tours.ts the steps per role (pure; tested)
features/onboarding/Tour.tsx the window; mounted in AppShell
```

- `Tour` opens only when the server said `toured: false`. A user object
  without the field, like an older test fixture, never opens it.
- A failed save doesn't reopen it in the same visit. It shows again next
  time.
- `openTour()` dispatches a window event, so a button anywhere can open it
  without a provider.

## Configuration

None.

## Extending it

- **A new step** is an entry in the role's list in `tours.ts`, guarded by
  `can(user, …)` when it depends on a capability.
- **A tour for another role** (an admin) is a function in `tours.ts` and a
  line in `tourFor`.

## Known limits

- **It describes, it doesn't point.** Steps name where things are, but don't
  highlight the real buttons. The sidebar and the phone's tab bar are laid
  out differently, and a spotlight that misses is worse than none.
- **Existing accounts see it once too.** `toured_at` is null for everyone
  who signed up before the tour existed, so each of them sees it on their
  next visit.
- **Pages outside the app frame don't show it**, such as the full-screen
  players and the chat. It waits for the next framed page.
