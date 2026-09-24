# Mentora

**Where teachers and students learn together.**

Teachers run classes, make quizzes and flashcards grounded in real sources,
share them with a class or a group, and see who is strong at what. Students join
with a link, play each set one question at a time with a buddy cheering them on,
and see their own strengths and the skills to practise next.

> **Status: under construction.** The platform is being built in phases —
> see [`PLAN.md`](PLAN.md) for the roadmap and what has been decided. Right now
> the codebase is the chat and artifact foundation, renamed; roles, classes,
> quizzes and flashcards arrive in the phases that follow.

## Quick start

```bash
git clone https://github.com/khaled-saiful-islam/mentora.git && cd mentora
cp .env.example .env          # then set LLM_API_KEY
make up
```

Open <http://localhost:8300> and sign in with **admin / admin**.

`make up` builds the images, waits for Postgres, runs migrations, seeds the
admin account and starts everything.

| Container | Port | |
|---|---|---|
| `mentora-frontend` | `8300` | The web app (nginx, proxies `/api`) |
| `mentora-backend` | `8301` | FastAPI — docs at `/api/docs` |
| `mentora-db` | `8302` | PostgreSQL 16 |

`make dev` serves the frontend with hot reload on `8303`.

> **Change `SEED_ADMIN_PASSWORD` and `JWT_SECRET` before deploying anywhere.**
> The app refuses to start with the shipped defaults when `APP_ENV=production`.

## Commands

```
make up        build, migrate, seed, start, print the login
make down      stop, keep the database
make dev       hot reload on both sides
make logs      follow logs
make test      backend pytest with coverage, then frontend vitest
make lint      ruff and tsc
make migrate   apply pending migrations
make reset     destroy the database and start clean
```

## Stack

FastAPI · Python 3.12 · SQLAlchemy 2.0 async · Alembic · Pydantic v2 ·
React · TypeScript · Vite · Tailwind · PostgreSQL 16 · Docker Compose

## Credits

Forked from [Pelita](https://github.com/khaled-saiful-islam/pelita).

## Licence

MIT. See [LICENSE](LICENSE).
