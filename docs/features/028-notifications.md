# 028 — Notifications

## What it does

A bell with a red badge, in the app header and the chat sidebar. News
arrives **live**: the count pops, the bell wiggles, and a toast says what it
is. Join requests can be answered **inside the bell** (Let in / Decline), after
which the row shows the outcome. Repeated news collapses: *"Mei and 2 others
finished Photosynthesis"* is one row.

**Seen and read are different.** The badge counts news you have not *looked
at* yet, so opening the bell clears it. Each note stays in **New** until you
act on it:

- **The action button** (from the kind's `action`, e.g. *Join*, *See results*,
  *Let's go!*; *Open* when a kind names none) marks it read and takes you
  there. Notes in **Earlier** keep the button, as an outline.
- **Mark as read**: the dot turns into a tick, then the note moves to Earlier.
- **Mark all read** does every note at once.

Kinds today: `join_request`, `join_approved`. The later phases add
`assignment_shared`, `completion` and `badge_awarded`; their rendering is
already in the frontend registry.

## How it works

- `notifications` rows are written by **event subscribers**, never inline in
  the services that cause them.
- `group_key` collapses repeats into one *unread* row whose `count` grows and
  whose `payload.actors` keeps the last five names. Once read, the next one
  starts a fresh row — having seen three is not having seen four.
- `seen_at` is set when the bell is opened (`POST /notifications/seen`) and
  when a note is read. A note that grows gets `seen_at` cleared, so the badge
  comes back for the fourth finisher even while the row stays unread.
- `resolve()` marks the notifications about a decided thing as decided (the
  approved join request stops offering buttons, from any tab it is open in).
- **Live delivery** (`services/realtime.py`):
  - An in-process hub keeps a queue per open connection.
  - `GET /api/notifications/stream` is SSE and carries **no content**, only
    "something changed". The browser then refetches the page it is showing, so
    the table stays the one source of truth.
  - A push is queued on the session and sent only **after commit**. A push
    before commit could announce a notification that a rollback then removes.
  - The stream authenticates with a session that closes at once
    (`StreamUser`). Holding the request's database connection open for the
    life of a tab would drain the pool with thirty open tabs.
- **The browser** (`NotificationsProvider`):
  - SSE with exponential backoff (2 s → 30 s).
  - Polls every 60 s while disconnected.
  - Refreshes when the tab becomes visible again.
- Old notifications are swept after 90 days, opportunistically (no cron).

## Endpoints

```
GET  /api/notifications              ?cursor=&limit=   newest first, with unread and unseen
GET  /api/notifications/unread-count                   {unread, unseen}
POST /api/notifications/seen                           the bell was opened: unseen → 0
POST /api/notifications/{id}/read
POST /api/notifications/read-all
GET  /api/notifications/stream       SSE: ready, notifications
```

## Extending it

- **A new kind**:
  - Add it to `core/notifications.py`.
  - Write the subscriber that creates it.
  - Add one entry to `frontend/src/features/notifications/kinds.tsx`, giving
    its icon, colour, words and link.
- **Email or push delivery**: add another subscriber on the same events. The
  bell is one reaction among many.

## Known limits

- **One API worker.** The hub is in-process. With several workers, a push
  reaches only the connections on the worker that made the change. The fix is
  a shared channel (Postgres `LISTEN/NOTIFY`) behind `RealtimeHub.publish` —
  the only place that changes.
- Pagination is by `(updated_at, id)`. A collapsed row that grows moves to the
  top, which is what a person expects and what makes "load older" skip nothing.
