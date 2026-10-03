# Live aircraft scheduling setup

The two pages are `/crew/scheduling` and `/crew/admin/scheduling`. Aircraft
registrations and confirmed airports belong to the local live fleet, separate
from the existing aircraft type/livery catalogue. Ordinary login and PIREPs are
unchanged.

## Enable local scheduling

1. Back up your database and manually run
   `migrations/20261002_live_scheduling.sql`. Do not rerun the full
   `crewcenterdb.sql` against an existing installation. The migration adds six
   tables and one transaction-mutex option; it grants no pilot access.
   The migration also creates the legacy `options` table if your installation
   omitted it. If an earlier copy created all six scheduling tables but failed
   with `Table '...options' doesn't exist`, run
   `migrations/20261002_live_scheduling_options_repair.sql` in that same database
   to complete the missing final step.
2. Create or select a **Live Pilot** award in the existing admin Awards page.
   Find its ID with `SELECT id, name FROM awards;` and configure the server
   environment variable `LIVE_PILOT_AWARD_ID` with that positive integer.
3. Grant the award to your live pilots through **Pilot Awards**. Grant staff the
   `scheduling` permission through **Manage Permissions**. Staff who already
   have the full `admin` permission do not need another permission.
4. Deploy and add individual aircraft in **Scheduling Administration → Live
   Fleet**. Choose an existing type/livery, unique registration, and its actual
   current ICAO airport. An unknown initial airport may be left empty: the pilot
   enters a departure, and first admin approval confirms that initial location.

All input schedule times are UTC. Callsigns are optional. Every new flight needs
admin approval; pending requests do not reserve the aircraft. Approved flights
allow their captain and two additional pilots. Captains or scheduling admins can
approve crew, start a flight, and confirm its actual arrival. A flight must be the
aircraft's next approved leg and its departure must match the actual location.
Scheduled arrival times never move aircraft automatically. Aircraft and pilot
booking conflicts are checked again inside the approval transaction.
Pilots can edit or withdraw pending requests. Scheduling admins amend, reassign,
or cancel approved flights.

Cancellation, diversion, and amendments flag affected downstream flights as
**Needs review**. Admins amend/reapprove them before they can start. Award
removal immediately blocks the affected pilot's scheduling actions; flagged
upcoming crew/captain assignments need admin repair. Flight history remains.

## Optional Infinite Flight integration

Current reference: [IF PublicApi v3 OAuth Preview](https://infiniteflight.com/guide/developer-reference/live-api/v3-oauth-live-preview).
It is an optional preview, disabled by default. Obtain a client approved for the
intended users, confirm the supported token-revocation endpoint, and obtain IF's
permission for durable organization/aircraft/schedule identifier mappings before
enabling automatic publishing. IF's [data-use rules](https://infiniteflight.com/guide/developer-reference/live-api/best-practices)
permit only short-lived operational caches of Live API responses; no fetched
fleet, coordinates, schedule response, or crew response is permanently imported.

Configure these **server-only** environment variables:

| Variable | Value |
| --- | --- |
| `IF_LIVE_PREVIEW_ENABLED` | `true` to enable admin OAuth linking and temporary reads; default `false` |
| `IF_LIVE_AUTO_PUBLISH_ENABLED` | `true` to enable the publishing worker; default `false` |
| `IF_LIVE_DURABLE_BINDINGS_ALLOWED` | `true` only after IF permits retained integration identifiers; default `false` |
| `IF_LIVE_CLIENT_ID` | Approved confidential OAuth client ID |
| `IF_LIVE_CLIENT_SECRET` | Client secret |
| `IF_LIVE_REDIRECT_URI` | Registered `https://YOUR_DOMAIN/api/admin/scheduling/if/callback` |
| `IF_LIVE_REVOCATION_URL` | Supported official HTTPS IF token-revocation URL; do not guess it |
| `IF_LIVE_TOKEN_ENCRYPTION_KEY` | Base64 of 32 random bytes for AES-256-GCM; back it up securely |
| `IF_LIVE_WORKER_SECRET` | A separate long random secret for the worker endpoint |

Generate secrets locally, without putting them in Git. For example,
`node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"`
generates an encryption key. Rotating that key requires disconnecting/reconnecting
the stored IF account with the old key available for revocation.

In **Scheduling Administration → IF Connection and Publishing**, connect an IF
organization owner/admin, select the organization, and explicitly bind each local
aircraft to its persistent IF aircraft. Ordinary pilots need no IF OAuth login;
their existing `pilots.ifuserid` identifies them. Crew must already belong to the
IF organization. Organization invitations and aircraft creation/relocation in IF
remain outside this application.

IF requires callsigns, so an empty local callsign is published as `WNC<flight ID>`.
Confirmed local airports remain authoritative for local scheduling: IF positions
show timestamped coordinates, not a confirmed ICAO airport.

Approvals and crew changes enqueue publishing atomically. The worker sends the
latest approved flight and complete crew assignment. A linked flight cannot start
locally until that revision has been published. Local-only aircraft continue to
work when IF is disabled. Pausing or disconnecting publishing does not remove
existing IF reservations; the admin page must reconcile outstanding reservations.

Publishing safeguards:

- A stable local UUID marker identifies application-managed IF schedules.
- External schedules and externally changed crew produce a conflict; they are
  never silently overwritten or deleted.
- The worker reads fresh IF schedules before publishing and reconciles the local
  queue order. It stops if reordering would shift an external or active reservation.
- An uncertain creation result goes to reconciliation before another creation
  attempt. **Retry** searches for the marker; **Recreate** explicitly authorizes
  another create after absence is confirmed; **Overwrite** explicitly resolves a
  conflicting application-managed schedule.
- Schedule and crew writes can partially succeed. Their checkpoint permits safe
  continuation. Credentials and fetched responses are excluded from job payloads,
  responses, and logs.

## Automatic publishing on Vercel Hobby

Vercel Hobby's built-in cron is daily, so do not add a minutely cron to
`vercel.json`. Configure one external job at [cron-job.org](https://cron-job.org/en/faq/):

- URL: `https://YOUR_DOMAIN/api/internal/if-live-publish`
- Method: **POST**, every minute
- Header: `Authorization: Bearer <IF_LIVE_WORKER_SECRET>`
- Disable saving response bodies; the endpoint returns aggregate counts only.

This scheduler receives only the dedicated worker secret, never IF credentials.
Jobs have processing leases, retries, and revision checks. A stopped worker leaves
work for a later invocation; an uncertain write requires reconciliation.
Publishing state/errors are visible in the scheduling admin page. Apply deployment
protection exceptions for this single endpoint if your Vercel deployment requires
them; its bearer-secret authentication must stay enabled.

## Verification

Run `npm test`, `npx tsc --noEmit --incremental false`, and `npm run build`.
The five isolated MySQL concurrency tests require a new, empty test database;
they never use the application's production DB environment. Run them with
`SCHEDULING_TEST_DATABASE_URL=mysql://user:password@127.0.0.1/webncrew_scheduling_test_local npm test -- src/lib/scheduling/service.integration.test.ts`.
Only database names starting with `webncrew_scheduling_test_` are accepted. A
remote test server additionally requires `SCHEDULING_TEST_ALLOW_REMOTE=true`.
The suite creates and removes its own tables after verifying the schema is empty.

Before enabling IF writes, use the approved preview/test organization to verify
linking, revoked credentials, assignment failures, external schedule conflicts,
uncertain creation, cancellation, and retry/reconciliation. Production database
migration, OAuth registration, and scheduler provisioning are operator steps.

### Checks completed in this workspace

- 208 automated tests passed; TypeScript and the production build passed.
- Both pages were checked at desktop and mobile widths with fictional sample data.
- Five MySQL concurrency tests were skipped because no isolated MySQL server was
  available. Run the command above before production rollout.
- Real IF OAuth/publishing was not exercised. No production migration, account
  connection, IF write, or deployment was performed; integration defaults off.
