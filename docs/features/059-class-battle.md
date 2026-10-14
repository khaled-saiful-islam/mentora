# 059 — Class Battle (§28.3.6, phase 8)

Live play for the whole class: the teacher puts the battle on the class
screen, every student answers on their own device, and right answers pull
the rope or hit the boss on the big screen as they come in.

## What a teacher sees

- On a ready **quiz or game** in the Library, **Class Battle, live**: pick
  **Tug-of-War** or **Class vs Boss**, pick the class, **Open the battle**.
- The class screen (`/battle/{id}`) opens on the lobby: "Join the battle!",
  and each student's buddy appears on their team as they join.
- **Start**, then each question big with the four coloured tiles, the
  clock (20 seconds), "3 of 25 answered", and the rope or the boss's health
  moving live. When everyone has answered, or time is up, the answer and why
  show for 5 seconds, then the next question.
- **Show the answer** / **Next question** move on early; **End** stops the
  battle at any time.

## What a student sees

- A notification ("Tug-of-War in 4 Cerdik: … Pick up your rope!") and a
  banner on their home, **Join the battle**, while it is on (checked every
  8 seconds).
- On their device (`/battle/{id}/play`): their team, their buddy dancing in
  the lobby, then each question with the same four tiles as a quiz. An
  answer **locks in**; right or wrong shows when the class sees the answer
  ("Right! Your team pulls!", "Hit! The boss felt that!").

## The two battles

- **Tug-of-War:** two teams, Harimau 🐯 and Kancil 🦌, kept even as students
  join (a late joiner goes to the smaller team). Every right answer pulls
  the rope by one step **shared across the team** (1 / players), so a
  bigger team doesn't win by being bigger: what counts is the share of the
  team that gets it right. Five steps wins; otherwise the end of the
  questions decides, or it's a draw.
- **Class vs Boss:** everyone against The Muddle Monster. Every right answer
  from anyone is a hit; a wrong one costs nothing, so nobody lets the team
  down alone. The boss has hits for 60% of every player answering every
  question right (at least 4).

## The end: nobody ranked

- The result: a team "pulls it home", a draw, "The boss is beaten!
  Together!", or "The boss got away… so close!".
- **Each team's spirit:** right answers, comebacks (a right answer straight
  after a wrong one), and "got better as it went" when the second half went
  better than the first.
- **Comeback crew:** everyone who came back from a miss, alphabetical.
- No scores per student, no leaderboard.

## How it works

- **Questions** (`app/battles/questions.py`): a quiz's questions, or a
  game's pairs (the left asks, the right answers, other right sides are the
  wrong options) and its Boss Battle questions, as the revision games make
  them. Up to 12, shuffled; at least 4 to open a battle. No model call.
- **The room** (`app/battles/room.py`) is in memory, like a live lesson's:
  teams, the question, each player's answers, the rope or the boss. Every
  change bumps a version; each screen follows `GET /api/battles/{id}/stream`
  (SSE) and gets its own view: the teacher everything shared, a student also
  their team and answer. The right answer is never sent before the reveal.
- **The clock** (`app/battles/hub.py`): one task per battle ticks four times
  a second. A finished battle stays 10 minutes for its last screen.
- **Who may:** only the class's teacher opens and runs it, from their own
  quiz or game; one battle per class at a time. Only approved students of
  the class join, answer and watch.
- **Endpoints:** `POST /api/battles` (open), `POST …/start`, `…/next`,
  `…/end` (teacher); `GET /api/battles/mine`, `POST …/join`, `…/answer`
  (student); `GET …/stream` (both).

## Configuration

None. The timings, the 5-step win and the boss's share are constants in
`app/battles/room.py`.

## Known limits

- **A battle lives in one server process:** a restart or deploy ends any
  battle running, and it can't run on more than one API worker (the same
  limit as live lessons).
- **Nothing is kept:** a battle doesn't show in results or count for badges
  and growth. It is revision for fun.
- **Students need a device each.** Without them, the single-screen
  Tug-of-War on a game's page (§26.8) still works.
- **Students find the battle by the notification or the home banner:**
  there's no code to type.
- **Only the teacher's own quizzes and games** can be used, not a
  colleague's shared one.
