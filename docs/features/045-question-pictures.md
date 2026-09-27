# 045 — Pictures beside questions, for Year 1–3

In the Year 1–3 look (`044-play-looks.md`), a quiz question or a flashcard's
front can show a photograph of what it is about. A picture appears only when
one was found that clearly fits and gives nothing away. Otherwise there is no
picture.

## What it does

- **Quiz:** a photo sits between the question's chips and the question,
  popped in like a sticker, with a small credit (*Picture: site.com*, linked
  to the page it came from).
- **Flashcards:** a smaller photo on the front of the card, above the word.
  The "Front" label steps aside, and the word is one size smaller so the front
  still fits. The credit names the site but isn't a link, because the card is
  a button already. Year 1–3 cards are a little taller on wider screens,
  whether or not they have a picture.
- **The right picture or none.** A photo must be a clear, child-safe fit for
  the item. For a quiz it must also not show, name, or point to the answer or
  any of the choices. Most questions about ideas (roles in a food chain,
  numbers, spelling) get no picture, and that is intended.
- **Preview.** A teacher or parent previewing a set in the Year 1–3 look sees
  exactly what a child would.
- Calm motion keeps the picture but drops the pop.

## How it works

```
learning/item_pictures.py        the searches, the guards, the spoiler check
services/item_picture_service.py what is known; finding the rest in the background
db/models/item_picture.py        item_pictures: one row per item looked at
GET /api/me/attempts/{id}/pictures      a student's attempt
GET /api/learning-sets/{id}/pictures    the owner's set, for preview
features/play/pictures.ts        polling, preloading, "in time" rule
PlayFun.tsx QuestionPicture      the frame
```

1. **The searches.** One model call per set sees every item *with its answer
   key*. For each item it writes a 3–7 word photo search of what the item is
   about, or `""` when a photo would not help or would give the answer away.
2. **Guard one: words.** If a quiz item's search names any of its choices
   (plurals count), the search is refused.
3. **The picture.** The search goes through `JudgedPictures`: SerpAPI with
   SafeSearch, https only, blocked hosts removed. The vision model scores each
   candidate, and only 7/10 or better is kept (`picture_check.py`).
4. **Guard two: the spoiler check.** For a quiz, the kept picture is shown to
   the vision model with the question, the choices and the right answer. It is
   used only if the model clearly says it gives nothing away. Anything else
   (yes, a garbled reply, no reply) drops it, and the next candidate is tried.
5. **What is kept.** For each item, a row holds the picture, or `null` when
   none fits, so nobody looks again. Rows are keyed by the set and a hash of
   what the item shows. An edit that changes the question is looked at again,
   and an edit elsewhere keeps the picture. The page title and the search
   snippet are dropped, because either can name the answer. The credit is the
   site's name, and the alt text is the search.
6. **In the background.** The first request for a set starts one run for it
   (in-process, so one per set however many children ask). The run handles
   three items at a time, early ones first, and saves each item as soon as it
   is done. The endpoint returns what is known and `done: false` until every
   item has a row.
7. **The player** asks every 3 s until `done`, for up to 30 tries. It fetches
   each photo ahead into the browser's cache. A question shows a picture only
   if the picture was known when the question appeared, or within 2.5 s of
   it, so the answers never move under a child's finger. The frame keeps its
   size while the photo loads, falls back to the search's small copy, and
   disappears rather than show a broken image.

## Configuration

Pictures need both of these. Without either, the endpoints answer
`{"pictures": {}, "done": true}` and nothing is looked for.

- `SERPAPI_KEY`: the picture search.
- `PICTURE_CHECK_MODEL`: the vision model that scores pictures and runs the
  spoiler check. A title-only check is not enough to put a picture beside a
  question.

## Extending it

- **Another kind** is a name in `KINDS`, plus a line in `_line` saying what
  the model should see.
- **Another look with pictures** sets `pictures: true` on its row in
  `level.ts`.

## Known limits

- **The very first play of a set may miss the early pictures.** Finding them
  takes around 30–60 s for ten items (one model call, then a search and one
  or two vision calls each). A question that appears before its picture is
  ready plays without one. After that first run, every child gets them at
  once.
- **Pictures are English searches**, whatever the set's language.
- **One worker.** A run lives in the API process. A restart mid-run leaves
  some items without a row, and the next request picks them up.
- **A set whose searches failed rests for 10 minutes** before it is tried
  again, so a player asking every few seconds doesn't call the model every
  few seconds.
- **The spoiler check is a model's judgement.** It is strict (anything but a
  clear "no" drops the picture), but it can still miss a clue a teacher would
  spot. The preview is where a teacher can see every picture before sharing.
