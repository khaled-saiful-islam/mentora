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
- A reply that was not JSON shows as a warning on the stage that got it.

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
- **Something worth seeing:** `note("island dropped as a repeat",
  metadata={...}, warning=True)` from anywhere inside a trace lands on the
  step running now.
- **Another backend** (OpenTelemetry, Phoenix, …): implement `Tracer` and
  `Observation` (`observability/base.py`) and return it from
  `observability/registry.build_tracer`.

## Known limits

- **Only model calls and stages so far.** The events and scores of §27.2
  (a round that fell back to Match Up, an island dropped as a repeat, items
  kept as a score) and the evals of §27.3 are the next phases.
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
