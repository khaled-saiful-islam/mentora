# Changelog

What changed, newest first, with what a deploy needs. Each entry links its
feature document; the design and the decisions behind it are in `PLAN.md`.
Older history is in `git log` and `PLAN.md`.

## Not yet in production: the engagement layer (§28), 2026-10-14

On GitHub `main`, **not deployed yet**. Eight phases that keep
students coming back, plus fixes from the first round of feedback.

### Before deploying

- **Five migrations** run on start, in this order:
  `2e03671504cc` buddy growth, `10760171ed1d` skill help,
  `36637def55d8` daily quests and skill memory, `5b81c0e4a7d2` second
  chances and test mode, `8d2f61a0b4c3` explain why.
- **Set `DEFAULT_TIMEZONE=Asia/Kuala_Lumpur`** on the server. Streaks, the
  Daily Quest and daily caps count the school's day; on UTC a day starts at
  8 am in Malaysia.
- **Every student's buddy becomes a baby** (stage 0), by decision
  (2026-10-13). An arrival scene introduces it on first sign-in.
- **Class Battles live in the API process**, like live lessons: a deploy
  ends any battle running, and the API must stay on one worker.
- New settings, all with defaults (see `.env.example`): `GAME_VOICE`,
  `GAME_VOICE_SPEED`, `RATE_LIMIT_SECOND_CHANCE_PER_MINUTE`,
  `EXPLAIN_WHY_PER_DAY`, `RATE_LIMIT_EXPLAIN_WHY_PER_MINUTE`.
- Recording each game's narration costs speech once per game (capped at 120
  clips); existing games record on first play.

### Added

| Phase | What | Doc | Commit |
|---|---|---|---|
| 1 | A buddy that grows from a baby as the student learns; new buddies earned with badges (one per 3) | [052](docs/features/052-growing-buddy.md) | `a35543f` |
| 2 | Every game told aloud like a mission: briefing, stings, a music bed that ducks, karaoke captions | [053](docs/features/053-mission-narration.md) | `952e066` |
| 3 | Help at home for parents (meaning, example, an activity), challenges, cheers; teacher practice for just the students who found a skill hard | [054](docs/features/054-help-at-home.md) | `f303ab7` |
| 4 | Today's Quest (5 questions, review first), streaks with freezes, the skill garden, the weekly class quest | [055](docs/features/055-daily-quest.md) | `232075e` |
| 5 | Second chance after a wrong answer: explained at Simpler / Just right / Challenge, then one like it; Test mode for teachers | [056](docs/features/056-second-chance.md) | `eae61b0` |
| 6 | Study guides as a journey: a one-minute game after each part, the buddy on the trail, a boss and a quiz at the end | [057](docs/features/057-learn-practise-play.md) | `7655dd3` |
| 7 | Drag everywhere with a magnet and a snap; Say It (Year 1–3 read aloud); Explain why (Form 1–5) | [058](docs/features/058-hands-and-voice.md) | `ef08dfb` |
| 8 | Class Battle: live Tug-of-War and Class vs Boss on students' devices, nobody ranked | [059](docs/features/059-class-battle.md) | `c8953d2` |

### Changed (feedback, `40f1440`)

- **Games speak in mission control's voice**: a deeper male voice at a
  steadier pace, with "Attention, agent…", "Here is your mission." and "Good
  luck, agent." around the story. Quizzes and guides keep the tutor's voice.
- **Buddies grow more slowly**: stages at 40, 200 and 600 growth (were 10, 60
  and 200), about a week, six weeks and a term of regular work.

### Still to check by a person

- **Say It with a real child's voice**, in English and Malay. The
  speech-to-text was only tried with a synthesized voice.
- **Explain why in a browser by a Form 1–5 student.** The demo students are
  in primary school; it is covered by tests.

## In production: every model call in Langfuse (§27), 2026-10-13

Every chat turn and every quiz, guide or game build is a trace, with tokens,
timings, cost, events and scores. Langfuse Cloud in production; `make
langfuse` locally. See [051](docs/features/051-observability.md).
Commits `d708451`, `8af1661`, `e612aae`.
