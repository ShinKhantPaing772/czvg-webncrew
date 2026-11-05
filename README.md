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
- MySQL through Sequelize (models in `src/lib/models/index.ts`)
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

## Environment variables

Required:

| Variable | Purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection (always over SSL) |
| `JWT_SECRET` | Signs login tokens |
| `IF_API` | Infinite Flight Live API key |

Optional:

| Variable | Purpose |
| --- | --- |
| `DB_SSL_CA` | CA certificate for the database (`\n` escapes allowed); turns on certificate checks |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true` to check the database certificate without a custom CA |
| `DISCORD_WEBHOOK` | New-PIREP and award announcements |
| `DISCORD_WEBHOOK_ADMIN` | New-application alerts for staff |
| `BREVO_API_KEY` | Application, approval and password-reset emails |
| `NEXT_PUBLIC_APP_URL` (or `APP_URL`) | Base URL used in email links |
| `NEXT_PUBLIC_BADGES_CDN_URL` (or `BADGES_CDN_URL`) | Where award badge images are hosted |

Live scheduling and the Infinite Flight OAuth connection (`IF_LIVE_*`,
`LIVE_PILOT_AWARD_ID`) are covered in [LIVE_SCHEDULING.md](./LIVE_SCHEDULING.md).

## Database

There is no migration framework. Apply the SQL files by hand:

1. `crewcenterdb.sql`: the base schema, including the live-scheduling tables.
2. `tokens.sql`: the login token table.
3. `migrations/*.sql` in date order: apply the ones your database doesn't
   have yet. Read each file's header first, since some changes are already in
   the base schema.

`migrations/20261105_create_missing_tables.sql` creates the applications,
password-reset and API cache tables. It only creates tables that don't exist
yet, so it's safe on any database.

Infinite Flight's terms allow Live API data only in short-lived caches. See
[.github/llms.txt](./.github/llms.txt) before storing anything from it.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on localhost:3000 |
| `pnpm build`, `pnpm start` | Production build, and serving it |
| `pnpm test` | Vitest suite. The two MySQL integration suites skip unless `SCHEDULING_TEST_DATABASE_URL` is set |
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
- [BULK_IMPORT_GUIDE.md](./BULK_IMPORT_GUIDE.md): importing routes from CSV
- [.github/llms.txt](./.github/llms.txt): Infinite Flight Live API reference
  and usage rules
