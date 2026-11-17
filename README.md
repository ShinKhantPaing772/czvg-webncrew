# CZVG Crew Center

The website and crew center for China Southern Virtual Group (CZVG), a
virtual airline on Infinite Flight.

- **Public site:** operations, fleet, hubs, ranks and routes.
- **Crew center:** pilots file PIREPs (by hand or with ACARS), browse routes,
  earn awards, get notifications and book live-scheduled flights.
- **Admin:** staff review applications and PIREPs and manage routes, fleet,
  ranks, awards, multipliers, permissions and live scheduling.

## Stack

- Next.js 15 (App Router) and React 19, deployed on Vercel
- PostgreSQL through Sequelize (models in `src/lib/models/index.ts`)
- shadcn/ui (Radix) and Tailwind CSS 3, with an English/Chinese UI
  (`src/lib/i18n.tsx`)
- Vitest for tests
- Infinite Flight Live API, Brevo for email, Discord webhooks for alerts

## Getting started

You need Node.js 20 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Put the environment variables below in a `.env` file, then open
<http://localhost:3000>.

### Configured local PostgreSQL workspace

Start Docker Desktop, then start the local database and app:

```bash
docker compose -f compose.postgres.yaml up -d --wait
pnpm dev
```

PostgreSQL 17 runs at `127.0.0.1:5432` with data in a persistent Docker volume.
This workspace's database was imported from the November 17, 2026 backup
snapshot; it is an independent local copy and does not sync with production.
The ignored `.env.postgres.local` contains the database credentials.
The app's ignored `.env.local` overrides `.env` to select this local database
and disable Infinite Flight, email and Discord integrations for local work.
Restart `pnpm dev` after changing these settings.

To stop PostgreSQL while preserving its data:

```bash
docker compose -f compose.postgres.yaml stop
```

## Environment variables

Required:

| Variable | Purpose |
| --- | --- |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL connection |
| `JWT_SECRET` | Signs login tokens |
| `IF_API` | Infinite Flight Live API key |

Optional:

| Variable | Purpose |
| --- | --- |
| `DB_PORT` | PostgreSQL port; default `5432` |
| `DB_SSL_CA` | Provider CA certificate (`\n` escapes allowed); TLS certificate checks are enabled by default |
| `DB_SSL` | Set `false` only for an explicitly configured local database without TLS |
| `DB_SSL_REJECT_UNAUTHORIZED` | Explicit `false` disables certificate verification; retain the secure default for hosted databases |
| `DB_POOL_MAX` | Connections per application process; default `3`, minimum `2`; does not cap total Vercel connections |
| `DISCORD_WEBHOOK` | New-PIREP and award announcements |
| `DISCORD_WEBHOOK_ADMIN` | New-application alerts for staff |
| `BREVO_API_KEY` | Application, approval and password-reset emails |
| `NEXT_PUBLIC_APP_URL` (or `APP_URL`) | Base URL used in email links |
| `NEXT_PUBLIC_BADGES_CDN_URL` (or `BADGES_CDN_URL`) | Where award badge images are hosted |

Live scheduling and the Infinite Flight OAuth connection (`IF_LIVE_*`,
`LIVE_PILOT_AWARD_ID`) are covered in [LIVE_SCHEDULING.md](./LIVE_SCHEDULING.md).

## Database

There is no migration framework. Create a **new, empty PostgreSQL database**
with `migrations/postgresql/001_baseline.sql`. This includes all current
tables, constraints and the scheduling mutex option. After importing explicit
IDs, run `migrations/postgresql/002_reset_identity_sequences.sql` while writes
are stopped.

The root `crewcenterdb.sql`, `tokens.sql` and dated SQL files directly under
`migrations/` are historical MySQL files. Do not run them on PostgreSQL.
Read [POSTGRESQL_MIGRATION.md](./POSTGRESQL_MIGRATION.md) for the rehearsal,
data mapping, acceptance checks and later cutover procedure. Preparing this
code does not move data, change hosted settings or deploy production.

The Aiven free PostgreSQL service's 20 connections are shared by all Vercel
processes, previews, scripts and operator sessions. Keep capacity available
for scheduling's separate short transactions; test the combined connection
usage before cutover. Database sessions use UTC and statements have a
15-second timeout.

Infinite Flight's terms allow Live API data only in short-lived caches. See
[.github/llms.txt](./.github/llms.txt) before storing anything from it.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on localhost:3000 |
| `pnpm build`, `pnpm start` | Production build, and serving it |
| `pnpm test` | Vitest suite. Database integration suites skip unless `SCHEDULING_TEST_DATABASE_URL` points to a disposable PostgreSQL test database |
| `pnpm lint` | ESLint |
| `pnpm sync:ifc-users` | Resolves pilots' Infinite Flight user IDs. Dry run by default; `--apply`, `--pilot-id <id>`, `--help` |
| `pnpm sync:awards` | Syncs the award catalog and grants awards pilots have already earned |

## Deployment

Vercel installs with `pnpm install --frozen-lockfile`, so commit
`pnpm-lock.yaml` whenever dependencies change (`pnpm add` and `pnpm remove`
keep it in sync). Apply new migrations before deploying code that needs them.

## More docs

- [LIVE_SCHEDULING.md](./LIVE_SCHEDULING.md): live aircraft scheduling and the
  Infinite Flight integration
- [POSTGRESQL_MIGRATION.md](./POSTGRESQL_MIGRATION.md): PostgreSQL setup,
  rehearsal and migration checks
- [BULK_IMPORT_GUIDE.md](./BULK_IMPORT_GUIDE.md): importing routes from CSV
- [.github/llms.txt](./.github/llms.txt): Infinite Flight Live API reference
  and usage rules
