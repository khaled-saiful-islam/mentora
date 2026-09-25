# 032 — Guardrails: keeping a student's chat safe

> **Students have no chat for now** (`use_chat` is off for them — see
> `025-roles-and-signup.md`), so none of this runs today. It stays in place,
> tested, for the day the chat is opened to them again.

## What it does

- **A student at risk is answered with care, not by the model.** A message
  about self-harm, abuse or bullying gets a kind reply instead. The reply:
  - thanks them for saying so
  - points them to a trusted adult and to free Malaysian helplines (Talian
    Kasih 15999 and WhatsApp 019-261 5999, Befrienders KL 03-7627 2929, and
    999 for emergencies)
  - is in English or Malay, following the conversation

  Every active admin gets a **Safety alert** in the bell, and the event waits
  in the safety queue for a person to look.
- **Unsafe requests are refused kindly, without calling the model.** This
  covers sexual content, how to make weapons, how to hurt someone, how to get
  drugs, gambling, and strong swearing. The refusal steers back to learning
  and never scolds.
- **Personal details are removed before anything sees them.** Phone numbers,
  IC numbers and email addresses are replaced with `[removed]` before the
  message is stored or sent. The student sees a friendly note about keeping
  details private.
- **An unsafe answer is withdrawn.** If the model's answer to a student
  contains plainly unsafe text, the chat replaces it with "Oops — I started to
  say something that isn't right for here…". The replacement is also what is
  saved.
- **Two kinds of topic are allowed through on purpose:**
  - **School questions about hard topics.** "How did the dinosaurs die?",
    "What is sexual reproduction in plants?", "Why are drugs like paracetamol
    used?" and "In the story the villain kills the king" are all answered.
  - **Unclear words go to a classifier, not straight to refusal.** A message
    like "what is sex" or "why do people take drugs" gets a short model check
    rather than being refused outright.
- **The assistant knows who it is talking to** (the persona, at prompt order
  110).
  - **For a student**, it is their buddy (Kiko, Bolt…). It knows their Year or
    Form and roughly their age. It guides them through homework rather than
    handing over answers. It never asks for personal details, and it points to
    a trusted adult when the student seems upset.
  - **For a teacher**, it is a concise teaching assistant for KSSR and KSSM.
- **Quiz topics are checked the same way.** A plainly unsafe topic ("how to
  make a bomb") is refused by the rules without a model call. Every refused
  topic is logged.
- **Everything that acted is logged** in `moderation_events` for the admin's
  review (`033-admin-console.md`). That includes prompt-injection findings,
  which were never saved before.

## How it works

```
moderation/
  base.py        Decision (allow · redact · review · block · support), Screening,
                 Screen and Classifier protocols, Flag (what gets logged)
  lexicon.py     the patterns, English and Malay, each with its benign twin in tests
  rules.py       InputRules (support → block → schoolwork allow-list → review;
                 redaction throughout), OutputRules (narrower, for answers)
  classifier.py  a 40-token model call, only for REVIEW; any failure allows
  replies.py     what the student sees instead, in their language
  gate.py        ModerationGate: rules, then classifier; output rules
  registry.py    build_gate: students only; staff get no gate
context/persona.py          PersonaContributor, order 110
services/turn_safety.py     the four points the chat turn calls in at
services/moderation_service.py   record (never raises), queue, review, counts
```

The turn calls into `turn_safety` at four points and has no other safety code:

| Where | What happens |
|---|---|
| `_open` | `screen_question`: redact, and decide, **before the message is stored**. |
| `_prepare` | `hold_or_note`: a BLOCK or SUPPORT message is held back from the model, with the reply it gets instead. A redaction becomes a `guard` event with rule `personal_info`. |
| `_generate` | `held_reply`: the reply streams as ordinary tokens, costs 0 tokens, and skips suggestions and memory extraction. |
| after `_generate` | `screen_answer`: an unsafe answer is replaced and a `retract` SSE event is sent. |
| after `_close` | `log_flags`: everything that acted is written in its own session. Logging failures are swallowed. |

- **Order within the rules:**
  1. Support comes first, so a child at risk is never answered as though they
     had broken a rule.
  2. Then block.
  3. The schoolwork allow-list ("sexual reproduction", "drugs like…") keeps
     obvious schoolwork away from the classifier.
  4. Review comes last.
- **The output rules are narrower than the input rules on purpose.** An answer
  about the Second World War says "guns". The output rules only catch explicit
  sexual words, weapon recipes, self-harm methods and strong profanity.
- **A new SSE event, `retract` `{text}`.** It is additive: an older client
  ignores it and shows the reply it is sent on reload.

## Configuration

| Setting | Default | |
|---|---|---|
| `MODERATION_ENABLED` | `true` | Screens students' chat. Staff are never screened. |
| `MODERATION_CLASSIFIER_ENABLED` | `true` | The model check for REVIEW messages. Off: they are allowed, and the persona still guards. |
| `MODERATION_CLASSIFIER_TIMEOUT` | `4` | Seconds before the check gives up and allows. |

## Extending

- **A new pattern** goes in `lexicon.py`, with an attack and a benign case in
  `tests/test_moderation_rules.py`. The benign case is the harder half.
- **A new screen** (a profanity service, a PII model) is a class with `name`
  and `screen(text) -> Screening`, passed to `ModerationGate(inputs=…)` in
  `registry.py`.
- **Another language** needs patterns in `lexicon.py` and replies in
  `replies.py`, keyed by the conversation's language code.

## Known limits

- **English and Malay only.** A message in Tamil or Chinese reaches the model
  unscreened, with the persona still in place.
- **Patterns, not understanding.** Misspellings and slang get past the rules.
  The persona and the classifier are the second and third lines.
- **Withdrawal comes after streaming,** so a student can see an unsafe answer
  for as long as it takes to arrive. Buffering would close that gap, at the
  cost of the typing effect.
- **Addresses are not detected.** Only phone numbers, IC numbers and email
  addresses are removed.
- **No retention limit yet.** Moderation events stay until the account is
  deleted, and deleting a student deletes their events.
- **Admins are alerted; teachers are not.** Who else should be told is a
  school's safeguarding policy, which Mentora does not assume.
