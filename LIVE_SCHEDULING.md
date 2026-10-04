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
intended users with schedule-write access, and obtain IF's permission for durable
organization/aircraft/schedule identifier mappings before enabling publishing.
IF's [data-use rules](https://infiniteflight.com/guide/developer-reference/live-api/best-practices)
permit only short-lived operational caches of Live API responses; no fetched
fleet, coordinates, schedule response, or crew response is permanently imported.

Configure these **server-only** environment variables:

| Variable | Value |
| --- | --- |
| `IF_LIVE_PREVIEW_ENABLED` | `true` to enable admin OAuth linking and temporary reads; default `false` |
| `IF_LIVE_AUTO_PUBLISH_ENABLED` | `true` to permit IF schedule writes from the admin publishing action and automatic worker; default `false` |
| `IF_LIVE_DURABLE_BINDINGS_ALLOWED` | `true` after IF permits retained integration identifiers; enables aircraft linking independently of publishing; default `false` |
| `IF_LIVE_CLIENT_ID` | Approved confidential OAuth client ID |
| `IF_LIVE_CLIENT_SECRET` | Client secret |
| `IF_LIVE_REDIRECT_URI` | Exact registered callback on the domain used for the admin page; see below |
| `IF_LIVE_REVOCATION_URL` | Optional for OAuth, reads, and publishing. Leave unset until IF confirms a supported official HTTPS token-revocation URL; disconnect then removes local credentials only |
| `IF_LIVE_TOKEN_ENCRYPTION_KEY` | Base64 of 32 random bytes for AES-256-GCM; back it up securely |
| `IF_LIVE_WORKER_SECRET` | A separate long random secret for the automatic worker endpoint; not needed for the authenticated admin publishing action |
| `IF_API` | Existing server Live API key, also used for type/livery validation and departure-airport coordinates |

Generate secrets locally, without putting them in Git. For example,
`node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"`
generates an encryption key. Disconnect/reconnect the stored IF account before
rotating that key. With a configured revocation URL, retain the old key until
remote revocation succeeds; local-only disconnect does not require decryption.

### Connect your existing IF confidential client

Your registered callbacks are supported without changing the IF client:

- Main site: `https://ifczvg.com/oauth/callback`
- Internal site: `https://internal.ifczvg.com/oauth/callback`

Set `IF_LIVE_REDIRECT_URI` to **one** of these for each deployment, matching the
domain where you open Scheduling Administration. Start the connection on that
same domain: the encrypted authorization cookie belongs to that website.
The older `/api/admin/scheduling/if/callback` endpoint also remains supported
for installations that registered it earlier. Both routes use the same handler.

For OAuth testing, configure `IF_LIVE_PREVIEW_ENABLED=true`, the approved client
ID and secret, the matching callback, and the encryption key. Leave
`IF_LIVE_REVOCATION_URL` unset until IF confirms a supported endpoint. Keep
`IF_LIVE_AUTO_PUBLISH_ENABLED=false` and
`IF_LIVE_DURABLE_BINDINGS_ALLOWED=false`. No worker is required to connect the
account and temporarily inspect its organizations and fleet. The admin tab
shows safe setup checks; it never returns client secrets or stored tokens.

The client must be **Confidential** with these requested scopes enabled:
`openid profile offline_access live:organizations.read live:aircraft.read
live:schedules.read live:schedules.write`. IF's
[client portal](https://infiniteflight.com/account/api-keys) manages registered
callbacks, invited testers, and review. The five-user testing limit shown for
your client concerns users authorizing that OAuth client. One organization
owner/admin connects the scheduler; additional pilots keep the site's existing
login and must be members of that IF organization when assigned to published
crew. They do not each authorize this OAuth client.

IF's public preview guide currently does not document a supported revocation
URL. Leave the setting unset until IF confirms that URL and its supported
client-authentication method. When configured, this application uses a
server-side form POST containing the confidential client credentials and token.
Do not substitute a guessed endpoint. Schedule writes do not depend on this
setting; disconnect without it deletes local credentials and does not revoke
the authorization at IF. The
[API overview](https://infiniteflight.com/guide/developer-reference/live-api/overview)
lists `hello@infiniteflight.com` for developer access questions.

The connection returns you to the Infinite Flight admin tab with a specific,
sanitized result. A failed or expired authorization can be retried from that
page. When an existing grant needs renewal, disconnect it first, then connect
again. When the revocation URL is unset, disconnect deletes the Crew Center's
saved access/refresh tokens and expiry under the connection lock, clears the
temporary cache, and stops publishing. It does not revoke the authorization at
IF; the dialog and result explicitly explain this. Revoke that authorization
through IF when supported. Local-only disconnect remains available even if the
preview flag, client credentials, callback, or encryption key are unavailable.

With a configured supported revocation URL, disconnect revokes the tokens at IF
before deleting the local credentials. Keep the original client credentials
and encryption key until revocation succeeds; errors preserve the local tokens
for retry. Preview access and callback configuration may be disabled during
revocation. An invalid nonempty revocation URL is rejected rather than silently
treated as successful revocation. OAuth, aircraft linking, and schedule publishing
can operate with the revocation URL unset.

In **Scheduling Administration → Infinite Flight**, connect an IF
organization owner/admin, then load organizations and temporarily view the fleet.
After IF permits durable identifier retention, set
`IF_LIVE_DURABLE_BINDINGS_ALLOWED=true`, save the organization, and explicitly
bind each local aircraft to its persistent IF aircraft. Linking works with
automatic publishing disabled and the revocation URL unset. The page shows
separate reasons when linking or publishing is unavailable. Ordinary pilots need no IF OAuth login;
their existing `pilots.ifuserid` identifies them. Crew must already belong to the
IF organization. Organization invitations and aircraft creation/relocation in IF
remain outside this application.

Each fetched IF aircraft also has **Add to local fleet**. Enter the local
registration, select an existing catalog type/livery, and confirm its airport
(or leave it unknown). IF registration is shown as a temporary reference, not
copied automatically. Choose whether to link the new aircraft; creation and
binding are one validated transaction, so a failed binding leaves no partial
local aircraft. Without identifier permission or a saved organization, this
action still creates an unlinked local aircraft. A matching local registration
is shown as already present and offered for linking instead of creating a
duplicate. Drafts close when the temporary fleet expires, the organization
changes, or IF read access is lost. No position or fetched schedule is imported.

Linking alone does not publish anything. Linked flights cannot start until
their latest approved schedule and crew are published; keep a tail unlinked
for local-only scheduling until publishing is enabled. Existing aircraft
catalog entries and pilot/admin-confirmed airports remain the local source of
truth. Publishing requires the publishing flag and permitted durable identifiers.
Automatic unattended publishing additionally needs the protected worker.

### View IF schedules and publish approved plans

Both scheduling pages have **Live fleet → View schedules** on each local
aircraft. Linked aircraft automatically load their IF itinerary when this dialog
opens. The dialog shows local flight decisions and publishing states alongside
IF routes, planned UTC times, lifecycle status, and assigned crew counts. Refresh
reloads the IF view; fetched schedules expire from the interface within 60
seconds. No IF response is imported into local flights or events. Schedule reads
remain available even when IF has no persisted aircraft position. A Live Pilot
award is required for pilot reads; scheduling admins can read without that award.

Set `IF_LIVE_PREVIEW_ENABLED=true`,
`IF_LIVE_DURABLE_BINDINGS_ALLOWED=true`, and
`IF_LIVE_AUTO_PUBLISH_ENABLED=true` in hosting and redeploy. The connected IF
owner/admin must have granted `live:schedules.read` and `live:schedules.write`.
Use **Publish queued flights** in an aircraft's schedule dialog to process that
aircraft only, or use the same button in the Infinite Flight admin tab to process
the whole eligible queue. Each click processes at most two jobs within 25 seconds;
run again for additional jobs or configure the automatic worker below. This
admin action uses the site's scheduling permission and never exposes the worker
secret or OAuth credentials. The write flag can disable all schedule writes
without hiding temporary schedule reads.

Only approved local decisions are published: flight approval/amendments and
crew changes synchronize the complete schedule and assigned crew; cancellation
and invalidated reservations remove application-managed IF bookings. Pending
requests do not publish. Existing IF flights without a local link remain a
temporary reference and are not silently adopted or edited. Conflict and
uncertain-write recovery continue through the existing admin IF controls. The
API provides no documented start/arrival mutation, so departure and actual
arrival confirmation remain local. The latest revision must still publish before
a linked local flight starts.

Binding checks current organization ownership, active fleet status, and the local
catalog's `ifaircraftid` and `ifliveryid` against IF's official content directory.
Incorrect or missing catalog mappings must be repaired before linking. If IF
returns a livery content ID, its model and configured livery must match. A
model-only content ID verifies the aircraft type but does not expose its livery;
confirm that livery in IF when selecting the aircraft. The publisher repeats
these checks, so a changed IF aircraft cannot silently receive a new reservation.

IF requires callsigns, so an empty local callsign is published as `WNC<flight ID>`.
Confirmed local airports remain authoritative for local scheduling: IF positions
show timestamped coordinates, not a confirmed ICAO airport.

Approvals and crew changes enqueue publishing atomically. The worker sends the
latest approved flight and complete crew assignment. A linked flight cannot start
locally until that revision has been published and a fresh departure check passes.
Start the local flight **before departing in IF**: its IF reservation must still be
scheduled, with the expected route, times, reference, and complete crew. No earlier
active IF reservation may remain. The aircraft must be on the ground within five
nautical miles of the departure airport's IF coordinates. This is a vicinity
check; the captain/admin still confirms the airport. If IF has no persisted
position or its APIs are unavailable, departure fails closed with a repair/retry
message. A parked aircraft's position timestamp may be old; fresh reads do not
require it to have moved recently. No fetched position is stored permanently.
Checks happen before database row locks and are revalidated against the current
local flight, crew, catalog, binding, connection, and a 30-second freshness limit
inside the mutation transaction. Local-only aircraft continue to
work when IF is disabled. Pausing or disconnecting publishing does not remove
existing IF reservations; the admin page must reconcile outstanding reservations.

Publishing safeguards:

- A stable local UUID marker identifies application-managed IF schedules.
- External schedules and externally changed crew produce a conflict; they are
  never silently overwritten or deleted.
- The worker reads fresh IF schedules before publishing and reconciles the local
  queue order. It stops if reordering would shift an external or active reservation.
- The combined IF/local itinerary must have continuous adjoining airports and
  non-overlapping times, including reservations created outside the crew center.
  Unpublished local future legs remain part of this validation; predecessors
  must publish before later legs.
- Invalidated/cancelled owned reservations are removed from downstream to upstream
  before amendments publish. Already Cancelled/Arrived IF reservations reconcile
  as terminal history without a delete, after reference and authored fields/crew
  are verified. External changes still require admin resolution.
- Candidate selection excludes blocked chains and busy aircraft before limiting
  the queue. A conflicted aircraft cannot consume the oldest candidate window and
  prevent unrelated aircraft from publishing. Claim checks repeat under locks;
  each invocation still processes at most two jobs within its time budget.
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
The isolated MySQL concurrency and publisher-selection tests require a new, empty test database;
they never use the application's production DB environment. Run them with
`SCHEDULING_TEST_DATABASE_URL=mysql://user:password@127.0.0.1/webncrew_scheduling_test_local npm test -- src/lib/scheduling/service.integration.test.ts src/lib/scheduling/infinite-flight/publisher.test.ts --no-file-parallelism`.
Only database names starting with `webncrew_scheduling_test_` are accepted. A
remote test server additionally requires `SCHEDULING_TEST_ALLOW_REMOTE=true`.
The suite creates and removes its own tables after verifying the schema is empty.

Before enabling IF writes, use the approved preview/test organization to verify
linking, revoked credentials, assignment failures, external schedule conflicts,
uncertain creation, cancellation, and retry/reconciliation. Production database
migration, OAuth registration, and scheduler provisioning are operator steps.

### Checks completed in this workspace

- Automated tests, TypeScript, and the production build passed; see the current
  task report for the latest test count.
- Both pages were checked at desktop and mobile widths with fictional sample data.
- Twelve isolated MySQL tests passed against a disposable MySQL 8.4 database,
  covering concurrent reservations/crew, actual candidate SQL/advisory locks,
  and aircraft-specific publishing/expired-lease isolation.
  The test container was removed afterward. These suites remain opt-in for normal
  test runs; rerun the command above when changing database or publishing logic.
- Real IF OAuth/publishing was not exercised. No production migration, account
  connection, IF write, or deployment was performed; integration defaults off.
