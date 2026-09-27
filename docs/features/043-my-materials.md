# 043 — My materials

A teacher's own files — worksheets, textbook chapters, notes — kept once and
made from again and again (PLAN.md §21).

## What it does

- **Library → My materials** holds the files. Drop them on the upload zone or
  choose them: PDF, Word, PowerPoint or plain text, up to 10 MB each, 100 per
  teacher. Each card shows the file type, size, pages or slides, when it was
  added, and the first lines of what it says.
- **Search** matches a file's name *and* what is inside it.
- **Make from this** opens the Create sheet with the topic filled from the
  file's title and the file already chosen.
- **The Create sheet** (quiz, flashcards, study guide) has a *From my
  materials* section. *Use my materials* opens a picker to choose up to 10
  files, or to upload one on the spot.
  - *Also search trusted sources to fill gaps* is on by default. Off, the set
    is made from the teacher's files alone.
  - While it is being made, the research step reads *"Reading your
    materials"* (or *"… and trusted sources"*).
- **Every item cites its file.** The files are the set's first sources,
  `M1`, `M2`…, shown as *your materials*, ahead of any web source (`s1`…).
- **Live lessons** get *From my materials* beside the upload button, which
  attaches a kept file without uploading it again.
- Rename and remove are on each card. Removing a file keeps everything
  already made from it.

### Photos (2026-09-27)

- **Take or upload a photo** from the Create sheet (*From a photo*), the
  materials picker, or *My materials*. On a phone the button offers the camera
  and the library. A textbook page, a worksheet, the whiteboard, a leaf or a
  model volcano all become a material.
- The vision model reads it with `LESSON_PROMPT` (`vision/base.py`): every word
  exactly, then *"What it shows:"* in enough detail to teach from.
- A photo keeps a small thumbnail for its card and chip. A camera name
  (`IMG_2031.jpg`) becomes a title from what the photo shows.
- In the Create sheet a photo is chosen at once, and fills the topic when it is
  still empty. Then it is made from like any other material, with or without
  the web.

## How it works

- Table `materials` (migration `d7f3b1c8e924`): owner, title, filename, media
  type, size, unit (`page`, `slide`, `paragraph`, `line`), unit count, and the
  extracted text. `learning_sets` gains `material_ids` (JSONB) and
  `web_sources` (bool).
- A file is **read once, at upload**, by `document_extract` — the same readers
  chat and live lessons use. The text is kept; the bytes are not. A file with
  no text (a scanned PDF) is refused with a message saying why.
- `services/material_service.py`:
  - Ownership is the lookup. Someone else's file is *not found*, on every
    path including generation.
  - `sources_for(owner, ids, topic)` picks the parts of each file that bear on
    the topic (`select_excerpts`). `MATERIAL_TOKEN_BUDGET` is split evenly
    between the chosen files, with at least 800 tokens each; a file that fits
    its share is sent whole.
- `GenerationService.request_with_materials` reads the files **before the
  request commits**, so a file that cannot be read fails the request. It never
  leaves a set stuck "being made". A retry reads them again.
- `LearningGenerator`: given sources come first. Web research runs only when
  there are none, or when `web_too` is set.
- Capability `keep_materials` (teachers and admins). The matrix test asserts
  every cell.

## Endpoints

```
GET    /api/materials?q=                     your files + the per-teacher limit
POST   /api/materials                        multipart `file`, upload-rate limited
PATCH  /api/materials/{id}                   {title}
DELETE /api/materials/{id}
POST   /api/learning-sets/generate           + material_ids (≤ 10), web (default true)
POST   /api/live-sessions/{id}/documents/from-material   {material_id}
```

## Configuration

| setting | default | meaning |
|---|---|---|
| `MATERIAL_MAX_BYTES` | 10485760 | largest file accepted |
| `MATERIALS_PER_OWNER` | 100 | files one teacher can keep |
| `MATERIAL_TOKEN_BUDGET` | 6000 | tokens of the chosen files one generation reads, shared between them |

## Extending it

- A new file type is a reader in `document_extract.py` plus a case in
  `classify()`. Materials, chat and live lessons all pick it up. The frontend
  adds its icon to `LOOKS` in `MaterialBits.tsx` and its extension to `ACCEPT`.
- Parents keep materials too (PLAN §20 P2), through the same
  `keep_materials` capability.

## Known limits

- **Scanned PDFs are refused.** A scanned page can be uploaded as a photo
  instead. A photo inside a PDF or Word file is not read.
- **Photos need a vision model** (`VISION_MODEL`). Without one they are refused
  with a message saying so. The photo is read once, at upload; the text is
  what is kept, along with a small thumbnail — not the original.
- **Excerpts are chosen by keyword scoring**, as for chat attachments. A topic
  worded differently from the file ("habitats" against a chapter on
  "ecosystems") may get the file's opening instead of its best part.
- **Only the extracted text is kept.** The original cannot be downloaded or
  re-read later with a better reader. Uploading it again makes a second copy.
- **Retrying a set whose file was removed is refused** (*"One of those files
  isn't in your materials any more."*). Make it again from the studio.
- **Search is a substring match** (`ILIKE`) over the title and text. Fine for
  100 files; it has no index and no ranking.
- A live lesson holds at most 5 files, whether uploaded or taken from
  materials.
