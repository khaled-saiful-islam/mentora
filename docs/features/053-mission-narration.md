# 053 — Every game told aloud, like a mission (§28.3.2, phase 2)

A game now plays like being sent on a mission: a briefing, a quiet tense
music bed, a sting for each moment, and a narrator who tells the whole story
while the words light up. It's dramatic, but **not loud**: the music sits
well under the voice and the voice a little under full, because games are
played in classrooms.

## What a child sees and hears

1. **The mission briefing**
   - A dark screen: a radar sweeping, a blip found on it, and
     **INCOMING MISSION…** typed out.
   - Then the game's name, "For Agent Aina", and the islands to explore.
   - **Start the mission.** That tap is what lets a browser play sound, so the
     music, the sting and the narrator all begin on it.
2. **The opening**, with its own sting:
   - **comic:** a "pow";
   - **news:** a "breaking news" sting;
   - **phone call:** the phone rings, again every few seconds, until it's
     answered;
   - **letter:** its seal pops as it is opened;
   - **postcard:** a whoosh as it turns.

   Then the narrator reads the hook, every line and the goal. Each word
   brightens as it is said and the word being said is marked, so listening
   teaches reading too. The goal reads **Your mission:**.
3. **Accept the mission.** A **MISSION ACCEPTED** stamp comes down with a
   thud and a chord, then the map opens.
4. **Each island:** a rising "approaching" sting, then the story beat, the
   idea and the task are read as the Learn it card appears.
5. **What you discovered:** the explanation and the beat after, read aloud.
6. **The ending:** a win fanfare, then the win and the ending read.

- **The music bed** plays on the map and the cards: a low drone, a slow
  heartbeat and a far-off note now and then. It **ducks** whenever the
  narrator speaks and **fades out during a round**, so the child can think.
- **One sound switch** (the game bar's) turns off everything: music, stings,
  narrator and blips. It is **remembered on the device**. With it off,
  "Read it to me" still reads on a tap.
- **Narration is in the game's language.**
  - English is read in the tutor's voice.
  - Other languages are read in the browser's own voice where the device has
    one. Words don't light up in that voice: it gives no timing.

## How it works

- **Narration by reference, as before.** The read-aloud routes say a part
  of an item or of the story (`services/read_aloud.py`). `usePlayVoice` now
  reports the line being said and when it started (`now`), and plays it a
  little under full.
- **Every card says what to tell.** `overlayFor` returns the card and its
  `Tell`: the lines and the sting before them. `GameHost`'s
  `useMissionSound` tells each card once, as it appears, after its sting.
  It does so only with sound on and only once the page has been touched,
  and stops the words when the card goes.
- **The opening waits for its words.** Each opening calls `onShown` when its
  story is on screen (after Answer, Open or the postcard's turn), and the
  narrator starts then.
- **Karaoke.**
  - `Said` (`mission/narration.tsx`) wraps any line a card shows.
  - When the narrator is saying that exact text, it splits it into words.
    Timings are estimated with the live lessons' `wordTimings` and lit on
    each animation frame.
  - Lines are matched by their words, so no ids are threaded through the
    cards.
- **Sound without files.** `mission/score.ts` synthesises the music bed and
  the stings with Web Audio. `LEVEL` holds every loudness in one place.
- **Recorded before anyone plays.**
  - When a game is built, `services/narration_warmup.py` records every line
    its narrator will say into the clip cache, in the background: once per
    buddy where a line names one, and once for a preview's "your buddy".
  - It's wired through `GenerationService(on_built=…)` in `api/deps.py`, so
    tests never call a voice. It's capped at 120 clips a game, and stops
    quietly if the voice is down.
  - The narrator is now one per process (`live/audio.shared_narrator`),
    shared by the routes and the recording, so a clip asked for twice is
    recorded once.

## Configuration

None new. The tutor's voice follows `SPEECH_MODEL`, `SPEECH_VOICE`,
`SPEECH_SPEED` and `READ_ALOUD_LANGUAGES`, as read-aloud does.

## Extending it

- **A new opening:** give it a sting in `STINGS`, call `useShown(onShown)`
  where its words appear, and play the sting in `GameHost.begin` or
  `storyShown`.
- **Another card told aloud:** return a `Tell` with it from `overlayFor`, and
  wrap its shown lines in `<Said>`.
- **Louder or softer:** `LEVEL` in `score.ts` and `VOICE_LEVEL` in
  `usePlayVoice.ts`.

## Known limits

- **Recording costs speech for every game built.** About 40–90 clips a game
  with the buddy variants. It's done once and cached on disk, but watch the
  speech bill.
- **The clip cache is the server's disk** (`LIVE_AUDIO_DIR`). A rebuilt
  server without that volume records again as games are played.
- **Word timings are estimates,** close within a line, never exact.
- **Browser-voice narration has no highlighting**, and its pace and voice
  depend on the device.
- **A child who joins mid-game** (islands already played) starts on the map,
  without the briefing. The music starts with their first tap.
- **Teacher previews** hear "your buddy" where a story names the buddy, as
  before.
