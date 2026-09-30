# 049 — Production deployment (mentora.stream)

Mentora runs in production at **https://mentora.stream**: one small AWS
Lightsail server in Singapore running the same Docker Compose stack as a
laptop, with Cloudflare in front for DNS, HTTPS and protection.

## What it is

```
Browser ──https──▶ Cloudflare ──https (origin cert + client cert)──▶ Lightsail 3.0.38.226
                   mentora.stream                                    nginx :443 ─▶ FastAPI ─▶ Postgres
                                                                     (all Docker, one box)
```

| Piece | Choice | Why |
|---|---|---|
| Server | Lightsail `small_3_0`: 2 vCPU, 2 GB RAM + 2 GB swap, 60 GB disk, Ubuntu 24.04, `ap-southeast-1` | Mentora uses ~200 MB at rest; $12/month flat including the IP and transfer; Singapore is closest to Malaysia |
| Database | Postgres 16 in Docker on the same server | Same as local, $0 extra; move to a managed database when it matters |
| Domain, DNS, TLS | Cloudflare (registrar and proxy) | Free HTTPS, caching of the static assets, DDoS protection, and the server's IP stays hidden |
| Deploys | `git pull` + `docker compose up --build` on the server | No registry or CI to run yet; one command |

## How it works

### Only Cloudflare can reach the server

- **Lightsail firewall:** 443 open to Cloudflare's IPv4 ranges only; 22 open
  to the owner's IP and to `lightsail-connect` (the browser SSH console). Port
  80 and everything else is closed.
- **`docker-compose.prod.yml`** publishes nothing but nginx on 443. The
  database (8302) and API (8301), published by the base file for local tools,
  are `!reset` — no second way in even if the firewall were opened.
- **Authenticated Origin Pulls:** Cloudflare presents a client certificate on
  every connection and nginx (`ssl_verify_client on`) refuses any connection
  without it. The firewall alone would still let *another* Cloudflare
  customer's zone reach this IP.
- **TLS on both legs.** Visitors get Cloudflare's certificate; Cloudflare
  talks to the server with a **Cloudflare Origin Certificate**
  (`deploy/certs/`, 15 years, server only, never committed). SSL mode is
  **Full (strict)**, so Cloudflare checks it.

### The server sees the real visitor

Every request arrives from a Cloudflare address. The API's per-IP limits (sign
in, share, invite) would otherwise count a whole school as one visitor.
`deploy/nginx/cloudflare-realip.conf` tells nginx to take the address from
`CF-Connecting-IP`, and only when the connection comes from a Cloudflare range,
so nobody else can forge it. nginx then appends that address to
`X-Forwarded-For`, and the API reads the last hop (`api/deps.py
client_address`).

### nginx configuration

- `frontend/nginx.site.conf` — the site: static files, the SPA fallback, the
  `/api/` proxy with SSE settings. Shared by both servers below.
- `frontend/nginx.conf` — plain http on 80. What `make up` serves on :8300,
  and what the container's healthcheck calls in production.
- `deploy/nginx/https.conf` — production only: 443 with the origin
  certificate, client-certificate check, and `www` → apex redirect.

### Cloudflare zone settings

| Setting | Value | Why |
|---|---|---|
| SSL/TLS mode | Full (strict) | Encrypted and verified to the server |
| Always Use HTTPS | on | http visitors are redirected |
| Minimum TLS | 1.2 | Old protocols off |
| Authenticated Origin Pulls | on | Cloudflare sends the client certificate nginx requires |
| Cache rule "Never cache the API" | `/api/*` bypass | Belt and braces: an API answer is never served to someone else |
| DNS | `A mentora.stream → 3.0.38.226` proxied; `CNAME www → mentora.stream` proxied | |

## Configuration

Production settings live in `/opt/mentora/.env` on the server only (mode 600).
It is the local `.env` with these changed:

| Setting | Production value |
|---|---|
| `APP_ENV` | `production` — the app refuses to start with any dev default (`core/config.py deployment_warnings`) |
| `CORS_ORIGINS`, `PUBLIC_BASE_URL` | `https://mentora.stream` |
| `AUTH_COOKIE_SECURE` | `true` |
| `JWT_SECRET`, `POSTGRES_PASSWORD`, `SEED_ADMIN_PASSWORD` | fresh random values, never reused from dev |

The admin sign-in is in `~/mentora-prod-admin.txt` on the owner's laptop. The
production database starts with that admin only; there is no demo data
(`make demo` refuses to run with `APP_ENV=production`).

## Operating it

```bash
ssh -i ~/.ssh/mentora-lightsail ubuntu@3.0.38.226
cd /opt/mentora

scripts/deploy.sh          # dump the DB, git pull, rebuild, wait until healthy
scripts/backup-db.sh       # dump now; nightly at 03:00 MYT from cron, 7 kept
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Restore a dump (replaces the database's contents):

```bash
docker compose exec -T db sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backups/<file>.dump
```

When Cloudflare announces new IP ranges: run `scripts/cloudflare-realip.sh`,
commit, deploy — and update the Lightsail firewall's 443 rule to match.

## Extending it

- **More capacity:** snapshot the instance and create a larger Lightsail plan
  from it (`medium_3_0`, 4 GB, $24), then move the static IP across. Minutes of
  downtime, no config change.
- **Managed database:** create a Lightsail or RDS Postgres, `pg_dump` /
  `pg_restore` into it, point `DATABASE_URL` at it and drop the `db` service.
- **Automatic deploys:** a GitHub Actions job that SSHes in and runs
  `scripts/deploy.sh` on every push to `main`.

## Known limits

- **One server, one process.** No redundancy: if the instance dies the site is
  down until it is restored. The job board, live rooms and background loops live
  in the single backend process, so **a deploy abandons anything being
  generated** at that moment. Deploy when nobody is building.
- **Backups stay on the same disk.** The nightly dump protects against a bad
  migration or a mistaken delete, not against losing the server. Lightsail
  snapshots (~$1/month) or copying dumps to S3 would cover that.
- **Cloudflare's 100-second limit.** Cloudflare returns a 524 if a request
  sends nothing for 100 s. Streams ping every 15–20 s, but the voice-lab lesson
  and photo reading are plain requests with a 120 s model timeout; a very slow
  model answer would surface as a 524.
- **Deploys build on the server.** A build takes several minutes on 2 vCPU and
  uses swap; the running site stays up until the new containers start.
- **SSH is limited to one home/office IP.** When that IP changes, update the
  Lightsail firewall (or use the Lightsail browser console, which is allowed).
- **Root AWS login** is used for administration. Create an IAM admin user with
  MFA and stop using root.
