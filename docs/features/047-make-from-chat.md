# 047 — Making quizzes, flashcards and study guides from the chat

A teacher or parent can ask the chat for a quiz, flashcards or a study guide
in their own words: *"Make me a quiz on fractions for Year 4 maths."* The
chat starts the same build as Library → Make, and the set appears as a card in
the conversation.

## What it does

- **It works out what it can, and asks only for the rest.** A set needs what
  to make, the school year, and what it is about: a topic, a subject, or
  both.
  - A topic with no subject: the chat works the subject out
    (*"a quiz about fractions, year 3"* → Mathematics) and makes it.
  - A subject with no topic (*"flashcards for year 5 science"*): it makes a
    set across that subject for the year, *"Science for Year 5"*.
  - It never asks which part of the topic, how many, or in what format. The
    maker picks a sensible spread for the year.
  - It asks, in one short question, only for what it can't work out: what to
    make, the year, or what it is about. It never guesses a year.

  > *Make me a quiz*
  > — Which year is it for, and what should it be about?
  > *Fractions, Year 4*
  > — *(starts it)*

- **A card follows the build**, in its kind's colours (quiz orange,
  flashcards teal, study guide blue), like the Library's cards.
  - While it is being made: *"Making it — about a minute"* with a moving bar,
    and **Watch it being made**. That opens the Library with the live
    creation panel showing each stage as it happens.
  - Once ready: *"Ready — 10 questions"* with **Preview** (play it as a
    student), **Share** (teachers: straight to a class, the same dialog as
    the editor's), and **Open** (the editor).
  - A failed build says so and opens to try again. A set deleted since says
    *"No longer in your Library."* The card is still there after a
    reload.
- **Everything else is as if it came from Make.** It is in the Library, the
  work tray shows it coming, and the bell rings when it is ready. A teacher's
  set is for sharing with a class; a parent's is for sending home.
- **Nobody else gets it.** A student's chat has no such tool, and neither
  does any account that cannot make sets. Posters, slides and the other studio
  artifacts stay switched off (`studio_artifacts`).

## How it works

```
tools/learning_set.py      MakeLearningSetTool: the checks, the year, the result
services/set_builds.py     build_in_background (also used by the Make form)
                           ChatSetMaker: limits, quota, begin, build
api/deps.py                the tool, for whoever can share or make family sets
context/persona.py         teacher and parent: be sure of topic, year, subject
components/chat/MadeSetCard.tsx   the card
```

- **The model is told twice.** The tool's description says to call it only
  with all four, and to ask for whatever is missing. The teacher and parent
  personas say the same. The tool checks again anyway: a call without them
  is refused with the question to ask, and nothing is made.
- **The year is read the way people write it:** *Year 4*, *year4*, *Tahun 4*,
  *Standard 4*, *Form 2*, *Tingkatan 2*, *Lower Six*. A year Mentora doesn't
  know (*Grade 12*) is asked about, not guessed.
- **Same limits as the form.** `RATE_LIMIT_GENERATE_PER_MINUTE` and the daily
  token quota are checked before anything is made, and a limit reached is said
  plainly in the chat.
- **The result is not a citation.** The tool returns the set as a result whose
  address is its page in the app (`/library/{id}`). `ToolResult.is_made` tells
  it apart by that shape, the same way a picture is told apart by its
  thumbnail. The chat service keeps it with the answer, so the card survives a
  reload (it is saved like a source, in `message_sources`). It gives the model
  the tool's own note ("tell the person, don't cite this") instead of the
  web-results framing. The browser splits made things from citations with the
  same rule (`isMade` in `lib/chat-events.ts`).
- **The card asks the set how it is doing** (`GET /api/learning-sets/{id}`)
  every 4 s while it is being made, and stops when the build ends.

## Configuration

None of its own. It uses the Make form's settings: the learning model,
search, `RATE_LIMIT_GENERATE_PER_MINUTE`, and the token quota.

## Extending it

- **Another kind** is a key in `KINDS` and `_KIND_WORDS` in
  `tools/learning_set.py`.
- **Another thing a tool makes in the app** just returns a result whose `url`
  is a path here. It is kept and shown apart from citations. It needs a card
  of its own in `MessageList` if it isn't a set.

## Known limits

- **It can't use the person's materials yet.** A set made from the chat is
  from the web (and the model's knowledge), like Make with no files chosen. To
  make one from your own files or a photo, use Library → Make.
- **The model decides when to call it.** With all four details it almost
  always does. The checks stop a set being made on a guess, but a model can
  still ask one question more than it needed to.
- **One build at a time counts against the per-minute limit**, the same as the
  form, so asking for five sets in one message starts as many as the limit
  allows and says the rest could not be started.
