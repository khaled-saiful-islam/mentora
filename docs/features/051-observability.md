# 051 — Observability: every model call in Langfuse (§27)

When a game came back with no story, or a quiz dropped two questions, the only
way to find out why was to read the logs line by line. Now every model call
Mentora makes is recorded in [Langfuse](https://langfuse.com): what was asked,
what came back, how long it took, the tokens, the cost, and which chat turn
or build it belonged to.

Off unless its keys are set. Locally it runs on your own machine
(`make langfuse`); production will use Langfuse Cloud (§27.5, not yet on).

## Using it locally

1. `make langfuse` starts Langfuse at **http://localhost:8310**. Sign in as
   `admin@mentora.test` / `mentora-local`. The first start takes a minute or
   two and creates the project **Mentora (local)** with the keys in `.env`.
2. `.env` needs the keys (`.env.example`, *Observability*): the two keys,
   any values as long as Langfuse was first started with the same ones, and
   `LANGFUSE_HOST=http://langfuse-web:3000`. Then `make up` once, so the
   backend picks them up.
3. Use Mentora: chat, make a quiz or a game. Each shows up in Langfuse under
   **Tracing** within a few seconds.
4. `make langfuse-down` stops it and keeps what it recorded. It uses about
   1.5–2 GB of memory while running.

What you will see:

| Trace | Opened by | Inside it |
|---|---|---|
| `chat turn` | each chat message | the answer (one call per round of tools), `safety check`, `search intent`, `suggestions`, `memory` |
| `build quiz`, `build game`, … | each set or game being made | one step per stage — `check`, `research`, `skills`, `write`, `finish` — holding that stage's calls (`check`, `draft`, `verify`, `repair`, `story`, …) |
| a call's own name (`live answer`, `studio plan`, …) | a model call made outside both | that one call |

- A **session** is a conversation, or a set: open one to see every turn of a
  chat in order, or a build with its retries.
- The **user** is a pseudonym (a hash of the person's id), never a name or an
  email; the role is a tag.
- A build's trace ends with how it went — `done` with the items kept out of
  those asked for, `refused`, or `failed` and why — and the tokens each stage
  spent.
- **Events** mark what Mentora itself decided, on the step where it
  happened (yellow when it is worth a look) — see below.
- **Scores** sit on each build's trace, to filter and chart by: Tracing →
  filter by score, or **Scores** in the menu.

### Events

| Event | Where | Means |
|---|---|---|
| `reply was not JSON` ⚠ | any build stage | the model's reply could not be read; asked once more |
| `item rejected` ⚠ | write | an item broke its kind's rules and was thrown away |
| `dropped as a duplicate`, `dropped as a repeat` | write | the same item again; a game island teaching an idea twice |
| `failed the check` ⚠ | write | the fact check flagged items, and why |
| `dropped after repair` | write | items still wrong after one repair |
| `fell back to Match Up` ⚠ | write | a game island's round broke its template's rules |
| `story written from the title` ⚠ | finish | the game's story could not be written |
| `Boss Battle added from pairs` | finish | the writer wrote no boss; Mentora made one |
| `pictures failed`, `wrap failed` ⚠ | finish | half the finishing failed; the set is whole without it |
| `topic refused` | check | which rule said no |
| `guard fired` ⚠, `tool done`, `tool failed` ⚠, `answer withdrawn` ⚠ | chat turn | a guard on a search result; a tool's outcome; the student output screen took an answer back |

An event's words (an island's text, the check's complaint) are kept only
where the trace may keep words (`LANGFUSE_CONTENT`); its counts always.

### Scores (builds)

| Score | Type | |
|---|---|---|
| `outcome` | label | `done`, `refused` or `failed` |
| `items_kept` | 0–1 | items made out of those asked for |
| `passed_first_check` | 0–1 | share of written items the fact check passed first time |
| `fallback_rate` | 0–1 | games: share of islands that fell back to Match Up |
| `repeats_dropped` | number | games: islands dropped for teaching an idea twice |

## How it works

```
LLMProvider (any) ──wrapped by──▶ providers/traced.py ──▶ observability/context.py ──▶ Tracer
                                  every call: model,       the trace this work is in    Langfuse, or one
                                  input, output, usage     (a context variable)         that records nothing
```

- **One wrapper sees every call.** `providers/registry.make_provider` builds
  every model client in the app — the chat's, generation's, live lessons',
  the studio's — and wraps it in `TracedProvider` when tracing is on. Nothing
  that makes a call changed; each only says what the call is for
  (`ChatRequest.purpose`).
- **Traces are opened where the work is run, not inside the streams.** A chat
  turn's trace is opened in the task that runs the turn
  (`services/live_turns.py`), once the turn says which conversation it is in;
  a build's in `GenerationService.events`, with `Steps` turning the
  generator's `Stage` updates into steps. The current trace travels in a
  context variable, so calls made in tasks the work starts land in it too.
- **Words only where allowed.** `LANGFUSE_CONTENT` decides per trace:
  `builds` keeps the full text of builds (curriculum: the topic, the prompts,
  the items written) and only sizes for everything else — a chat call is
  recorded as `{"messages": 4, "characters": 2310}`, never what anyone wrote.
  Students are children and teachers' chats can name them.
- **Never breaks a turn** (rule 3). Every call into the tracer goes through
  `context.quietly`, and the Langfuse adapter fails quietly too; the SDK
  sends from a background thread. With Langfuse down, a turn answers exactly
  as before (`test_observability.py`).
- **Costs** are Mentora's own estimate, from `LLM_PRICE_INPUT_PER_1M` and
  `LLM_PRICE_OUTPUT_PER_1M` (USD only), the same prices its own cost table
  uses.

## Configuration

| Setting | Default | |
|---|---|---|
| `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` | empty | All three, or tracing is off |
| `LANGFUSE_CONTENT` | `builds` | `builds`, `all` or `none` — whose words are sent |
| `LANGFUSE_SAMPLE_RATE` | `1.0` | Share of traces kept |
| `LANGFUSE_PORT` | `8310` | Where `make langfuse` publishes the local web app |

The local `.env` uses `LANGFUSE_CONTENT=all`: it is demo data, and seeing a
chat's words helps. Production will use `builds`.

The local stack is `docker-compose.langfuse.yml`: Langfuse's own Compose file
(v4) with its services renamed, only the web app published (on 127.0.0.1),
its telemetry off, and every service in the `langfuse` profile so `make up`
never starts it. Production's `scripts/deploy.sh` never reads that file.
Tests never send traces: `conftest.py` clears the keys.

## Extending it

- **A new kind of work as its own trace:** wrap where it is run in
  `opened(get_tracer(), TraceInfo(name=..., kind=...))`. `Kind.BUILD` keeps
  words under `builds`; `Kind.CHAT` and `Kind.OTHER` do not.
- **Something worth seeing:** `note("dropped as a repeat", metadata={...},
  words={...}, warning=True)` from anywhere inside a trace lands on the step
  running now and is counted; `count(name, n)` only counts.
- **A new score:** add it to `services/build_trace.build_scores`, from the
  build's last event and what its trace counted.
- **Another backend** (OpenTelemetry, Phoenix, …): implement `Tracer` and
  `Observation` (`observability/base.py`) and return it from
  `observability/registry.build_tracer`.

## Known limits

- **No teacher-side score yet.** How much a teacher edited a set, or
  rewrote it with AI, is the score that says most about quality; it needs
  the editor to report back, and is not built. Evals (§27.3) are next.
- **Fallback rate counts islands as written**, before the fact check drops
  any, so it says how often the writer broke a template, not how many of the
  final islands are Match Up.
- **Vision calls are not traced** — the image reader and the picture check
  use their own clients. Nor are speech and web search, which are not
  language-model calls.
- **A streamed answer is recorded when it finishes**, not as it streams, and
  an answer the person stopped is recorded as `stopped` with what came so far.
- **Costs are estimates** at the chat model's prices, even for calls made by
  another model (`LEARNING_MODEL`), as in Mentora's own cost table.
- **The local keys are fixed at the first start.** Langfuse creates the
  project from `.env` once; change the keys later and you must change them in
  Langfuse too (project settings), or wipe it: `docker volume rm` the
  `mentora_mentora-langfuse-*` volumes.
- **Production is not on yet.** Langfuse Cloud keeps data in the EU or US for
  30 days on the free plan; turning it on is phase 5 of §27, on your word.
