# 048 — Parent–teacher messages

A parent and their child's teacher can write to each other, live, about
the child: how they are getting on, what the homework asks, and what would
help at home. Students never see these messages. They have no chat, and
these conversations are between adults.

## Try it

`make demo` seeds a short conversation between **Aina's mum**
(`parent.demo@mentora.local` / `demo-parent-1`) and **Cikgu Demo**
(`cikgu.demo@mentora.local` / `demo-teacher-1`), ending on the mum's
thank-you. The teacher sees it waiting in the envelope and the bell
(`app/scripts/demo_messages.py`).

To watch it live, open the same conversation as each of them in two
browsers. What one sends appears for the other without a reload.

## What it does

- **Who can write to whom.**
  - A parent can write to the teacher of every class their linked child is
    in.
  - A teacher can write to the linked parents of every student in their
    classes.
  - Both need the link to still hold (see *How it works*).
- **One conversation per parent, teacher and child.** A parent with two
  children in one teacher's class has two conversations, so each stays
  about one child. The header of each says who it is with and which child:
  *Teacher · 4 Cerdik*, or *Mum · about Aina*.
- **Where to start one:**
  - **Messages** (`/messages`), from the sidebar or the envelope in the
    header. *New message* lists everyone this person can write to, grouped
    by child, with a search box once the list has six or more people.
  - On the parent's view of a child, under **Classes**: *Message Cikgu …*
    beside each class.
  - On a teacher's class, under **Students**: a message icon beside each
    student whose family is connected. With two parents connected, it asks
    which one.
- **The conversation.**
  - Messages are grouped by day (*Today*, *Yesterday*, then the date).
  - Enter sends and Shift+Enter starts a new line.
  - Near the 2,000-character limit, a counter appears under the box.
  - An empty conversation offers three ways to start. For a parent: *How is
    Aina getting on in class?*. For a teacher: *Aina did really well this
    week!*.
  - The header links a parent to the child's results, and a teacher to the
    class.
- **Knowing a message came.**
  - The **envelope** in the header, beside the bell, counts unread messages
    on every page and screen size. The sidebar's **Messages** item shows
    the same count.
  - The **bell** rings once per conversation (`parent_teacher_message`):
    *"Nora sent you a message about Aina"*. Further messages grow that one
    note (*"3 new messages from Nora about Aina"*) until the conversation is
    read. Opening the conversation reads the note too.
- **Layout.** Below `lg`, one pane shows at a time: the list, or the
  conversation with a back arrow. From `lg` up, the two sit side by side.
  The app's own sidebar leaves too little room for two panes at `md`.

## How it works

- **Tables** (migration `c4f7a9d2e615`):
  - `parent_teacher_threads`: parent, teacher and student, unique together.
    Each side has its own `*_read_at`, and `last_message_at` sorts the list.
  - `parent_teacher_messages`: the thread, the author, the body, and a
    `clock_timestamp()` time.
- **The gate** (`services/parent_teacher/contacts.py`) works out, fresh on
  every call, who this person may write to:
  - a `family_links` row for the parent and child, and
  - an approved `class_memberships` row for the child, in a class the
    teacher teaches that is not archived.

  Every read and write goes through it. A thread that is not yours, or
  whose link has ended, is *not found*, the way a child who is not yours is.
  So when a child leaves the class, the class is archived, or the parent
  disconnects, the conversation closes for both sides at once, with nothing
  to clean up.
- **Sides.** A parent account writes as the parent, and a teacher or admin
  account as the teacher. Capability `parent_teacher_messages` is on for
  parents, teachers and admins, and never for students. The matrix test
  pins every cell.
- **Live.** Sending pushes `{"topic": "messages", "thread_id": …}` to both
  people after commit (`services/realtime.py`). Pushes reach every open tab:
  - an open conversation fetches its newest page and merges it in;
  - the list reloads;
  - the envelope asks for its count again.

  Reading a conversation pushes to the reader too, so their other tabs
  clear their counts.
- **Unread** counts the other side's messages newer than your
  `*_read_at`. Reading sets it to the newest message's time (the
  database's clock, not the browser's). A message you send counts as read
  by you.
- **The bell** uses the notifications' `group_key` (`pt-thread:<id>`), so
  repeats collapse into one note. `NotificationService.mark_group_read`
  reads it when the thread is read.
- **Pages** come newest first, 40 at a time. *Earlier messages* pages back
  with `before=<message id>` and keeps the reader's place.
- **The list** shows only conversations with at least one message. A
  conversation opened but never written in stays out of both people's
  lists, and opening the same person again finds it.
- **The API** (`routes/messages.py`):

  | Route | What it does |
  |---|---|
  | `GET /api/messages` | Conversations, contacts and the unread total |
  | `GET /api/messages/unread` | The unread total, for the envelope |
  | `POST /api/messages/threads` | `{student_id, person_id}`: opens or makes the conversation |
  | `GET /api/messages/threads/{id}` | One conversation's header |
  | `GET /api/messages/threads/{id}/messages?before=` | A page of messages |
  | `POST /api/messages/threads/{id}/messages` | `{body}`: sends, rate limited |
  | `POST /api/messages/threads/{id}/read` | Reads it; returns the unread total |

## Configuration

| Setting | Default | What it does |
|---|---|---|
| `RATE_LIMIT_MESSAGES_PER_MINUTE` | `30` | Messages a person may send per minute. `0` turns the limit off. |

The 2,000-character limit is `MAX_BODY` in `services/parent_teacher/service.py`.
The frontend mirrors it in `features/messages/api.ts`.

## Extending it

- **Another way in** (a button on a result, say *"Ask about this quiz"*):
  - `useOpenThread().open(contact, draft)` opens the conversation.
  - Its `draft` arrives in the route state and prefills the box.
  - `useContacts(user)` gives the contacts for a page in one request.
- **Another kind of person** (a school counsellor, say): add the side in
  `contacts.py`. Every rule in the service reads the gate.
- **Attachments** would be a new table beside the messages. The body stays
  text.

## Known limits

- **A conversation closes when its link ends.** A child who leaves the
  class, an archived class, or a parent who disconnects hides the
  conversation from both sides. It comes back if the link returns. Nothing
  is deleted, but nobody can read it in between.
- **No typing indicator, read receipts or edits.** A sent message cannot be
  changed or taken back.
- **No safety screen.** These are adults writing about a child they share.
  The student guardrails (`032-guardrails.md`) are not applied, and
  nothing is moderated.
- **One API worker.** Like every other live push, `messages` goes through
  the in-process hub. More workers need a shared channel
  (`services/realtime.py`).
- **Contacts are worked out on every call.** A teacher with hundreds of
  families pays one join per request. That is fine for a school's classes,
  but it is not built for a district.
- **The list does not show a long last message.** Under 90 characters it
  shows whole. A longer one reads *"Nora sent a longer message"*, because
  Mentora never cuts text.
- **Email and push to a phone are not sent.** Only the in-app bell and
  envelope show a message.
