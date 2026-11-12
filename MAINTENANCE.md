# Manual Crew Center maintenance switch

`CREW_LOGIN_DISABLED` pauses all Crew Center access. It is **off by default**.
There is no automatic schedule: the November 16 announcement does not turn it on.

## Start maintenance

1. Open the `czvg-webncrew` project in Vercel.
2. In **Settings → Environment Variables**, set `CREW_LOGIN_DISABLED` to `true`
   for **Production**.
3. Redeploy the current production release to apply the setting.
4. Open `/crew` and `/crew/home`. Both should show the maintenance page.
   `/api/auth/maintenance` should report `{"loginDisabled":true}`.

While enabled, every Crew Center page shows maintenance, and every API request
except the maintenance status check returns HTTP 503 before reaching its handler.
This blocks sign-ins, applications, existing sessions, PIREPs, scheduling, admin
actions, ACARS and Infinite Flight callbacks. Staff and administrators are
blocked too. The public website remains available.

Existing session tokens are kept, but cannot access Crew Center while the switch
is on. An already-open tab moves to maintenance when it next checks its session;
its API requests are blocked immediately. Requests that began before deployment
and independently running operator scripts must finish or be stopped before
exporting the database.

## Restore access

1. Set `CREW_LOGIN_DISABLED` to `false` (or remove it) in Vercel.
2. Redeploy again.
3. Verify `/crew` displays the normal sign-in flow and test Crew Center access.

You can restore access through Vercel even if every Crew Center user is signed
out. Changing the setting affects new deployments; it does not change an
already-running deployment.
See [Vercel's environment-variable guide](https://vercel.com/docs/environment-variables/managing-environment-variables).

For local testing, set `CREW_LOGIN_DISABLED=true` in the environment and restart
the development server. The status endpoint `/api/auth/maintenance` reports
`{"loginDisabled":true}` while the switch is enabled and never needs a database
connection.
