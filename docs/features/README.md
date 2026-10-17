# Feature documents

One document per feature: what it does, how it works, its configuration,
how to extend it, and its known limits. A new feature adds one here, and a
line to this index, in the same commit (`CLAUDE.md`, "Adding a feature").

**Start here:** [`README.md`](../../README.md) for what Mentora is,
[`CLAUDE.md`](../../CLAUDE.md) for how to work in the code,
[`CHANGELOG.md`](../../CHANGELOG.md) for what changed lately and what a
deploy needs, [`PLAN.md`](../../PLAN.md) for the roadmap and the decisions.

## The engagement layer (§28, October 2026)

What keeps students coming back: a buddy that grows, games told like a
mission, a daily quest, second chances, journeys through guides, voice and
drag, and live class battles. The newest work; start here if you are new.

| Doc | What | Main code (backend `app/…`, frontend `src/features/…`) |
|---|---|---|
| [052](052-growing-buddy.md) | A buddy that grows as you learn; new buddies earned with badges | `app/growth/`, `services/growth_service.py`, `features/buddies/` |
| [053](053-mission-narration.md) | Every game told aloud by mission control, with music and stings | `features/game/mission/`, `services/narration_warmup.py`, `services/read_aloud.py` |
| [054](054-help-at-home.md) | Help at home for parents; practice for the students who found a skill hard | `services/skill_help_service.py`, `services/skill_practice.py`, `features/family/child/` |
| [055](055-daily-quest.md) | Today's Quest, streaks with freezes, the skill garden, the class quest | `app/quests/`, `services/quest_service.py`, `features/quest/` |
| [056](056-second-chance.md) | After a wrong answer: explained at your level, then one like it | `services/second_chance_service.py`, `features/play/SecondChance.tsx` |
| [057](057-learn-practise-play.md) | Study guides as a journey: a game per part, a boss, a quiz | `features/guide/journey.ts`, `features/guide/GuideJourney.tsx`, `services/guide_quiz.py` |
| [058](058-hands-and-voice.md) | Drag everywhere, Say It (read aloud), Explain why | `features/game/rounds/drag.ts`, `rounds/SayIt.tsx`, `services/say_it.py`, `services/explain_why.py` |
| [059](059-class-battle.md) | Live Tug-of-War and Class vs Boss on students' devices | `app/battles/`, `services/battle_service.py`, `features/battle/` |

## Learning: making and playing

| Doc | What |
|---|---|
| [029](029-learning-sets.md) | Quizzes and flashcards: generation, editing, sharing |
| [034](034-study-guides.md) | Study guides: three reading levels, pictures, checks |
| [050](050-play-and-learn.md) | Play and Learn games from Mentora's own templates |
| [030](030-taking-and-results.md) | Taking sets, results, badges and the leaderboard |
| [044](044-play-looks.md) | Three looks by year, and preview as a student |
| [040](040-made-for-you.md) | Practice made from what a student found hard |
| [043](043-my-materials.md) | A teacher's own files as sources |
| [041](041-coverage-map.md) | Coverage map: the syllabus per class |
| [047](047-make-from-chat.md) | Making quizzes, flashcards and guides from the chat |
| [031](031-study-buddies.md) | Study buddies |

## Live lessons

| Doc | What |
|---|---|
| [036](036-live-tutoring-voice-lab.md) | The voice lab (phase 0) |
| [037](037-live-lessons.md) | Setup, the lesson plan and the schedule |
| [038](038-live-room.md) | The live room: a lesson taught to a group, in step |

## People, classes and families

| Doc | What |
|---|---|
| [004](004-auth-and-profile.md) | Authentication and profile |
| [025](025-roles-and-signup.md) | Roles, signup and preferences |
| [027](027-classes-and-invites.md) | Classes, groups, invites and joining |
| [042](042-parents.md) | Parents |
| [048](048-parent-teacher-messages.md) | Parent–teacher messages |
| [028](028-notifications.md) | Notifications |
| [046](046-first-visit-tour.md) | The first-visit tour |
| [022](022-user-management.md) | User management and token quotas |
| [033](033-admin-console.md) | The admin console |

## Safety

| Doc | What |
|---|---|
| [032](032-guardrails.md) | Guardrails: keeping a student's chat safe |
| [015](015-prompt-injection-guard.md) | Prompt-injection guard |
| [021](021-rate-limiting.md) | Rate limiting |

## The chat platform underneath

| Doc | What |
|---|---|
| [001](001-provider-adapter.md) | Provider adapter |
| [002](002-context-pipeline.md) | Context pipeline |
| [005](005-streaming-chat.md) | Streaming chat and server-side stop |
| [006](006-conversations.md) | Conversation history |
| [007](007-message-actions.md) | Message actions |
| [008](008-markdown-export.md) | Markdown export |
| [009](009-token-and-cost-accounting.md) | Token and cost accounting |
| [010](010-language-detection.md) | Language auto-detection |
| [011](011-web-search.md) | Web search |
| [013](013-memory.md) | Memory |
| [014](014-suggestions.md) | Follow-up suggestions |
| [017](017-images-and-citations.md) | Image search and clickable citations |
| [018](018-documents.md) | Document upload |
| [019](019-image-understanding.md) | Reading uploaded images |
| [020](020-tool-calling.md) | Tool calling |
| [023](023-share-links.md) | Public share links |
| [024](024-artifacts.md) | Artifacts (switched off) |
| [035](035-studio-and-create.md) | The studio and the Create menu (switched off) |

## Look and feel

| Doc | What |
|---|---|
| [026](026-design-system.md) | Design system: theme, type, motion, text size |
| [016](016-theme.md) | Theme |

## Running it

| Doc | What |
|---|---|
| [003](003-docker-and-make.md) | Docker and Make |
| [039](039-background-work.md) | Background work |
| [049](049-production-deployment.md) | Production deployment (mentora.stream) |
| [051](051-observability.md) | Observability: every model call in Langfuse |

Numbers 012 and 045 were never used.
