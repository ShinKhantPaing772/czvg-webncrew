#!/usr/bin/env node

import process from "node:process";

import nextEnv from "@next/env";
import mysql from "mysql2/promise";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(
  process.cwd(),
  process.env.NODE_ENV !== "production",
);

const IF_USERS_URL = "https://api.infiniteflight.com/public/v2/users";
const IF_BATCH_SIZE = 25;
const IF_REQUEST_INTERVAL_MS = 2_100;
const IF_REQUEST_TIMEOUT_MS = 20_000;
const IF_MAX_ATTEMPTS = 3;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function printUsage() {
  console.log(`Synchronize pilots with Infinite Flight Community identities.

Usage:
  npm run sync:ifc-users
  npm run sync:ifc-users -- --apply
  npm run sync:ifc-users -- --pilot-id=123
  npm run sync:ifc-users -- --pilot-id=123 --apply

Options:
  --apply             Write verified changes to the pilots table.
  --pilot-id=<id>     Audit only one local pilot.
  --help              Show this help.

The default mode is a dry run. Environment variables are loaded with Next.js'
normal .env file rules and require IF_API plus the DB_* settings.`);
}

function parseOptions(argv) {
  const options = { apply: false, pilotId: null, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--apply") {
      options.apply = true;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    if (argument === "--pilot-id") {
      options.pilotId = parsePilotId(argv[index + 1]);
      index += 1;
      continue;
    }

    if (argument.startsWith("--pilot-id=")) {
      options.pilotId = parsePilotId(argument.slice("--pilot-id=".length));
      continue;
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return options;
}

function parsePilotId(value) {
  const pilotId = Number(value);
  if (!Number.isInteger(pilotId) || pilotId <= 0) {
    throw new Error("--pilot-id must be a positive integer");
  }
  return pilotId;
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value) {
  return stringValue(value).toLocaleLowerCase("en-US");
}

function isUuid(value) {
  return UUID_PATTERN.test(stringValue(value));
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryAfterMilliseconds(value) {
  if (!value) return 0;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

  const date = new Date(value).getTime();
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

let lastInfiniteFlightRequestAt = 0;

async function throttleInfiniteFlightRequest() {
  const elapsed = Date.now() - lastInfiniteFlightRequestAt;
  const waitFor = Math.max(0, IF_REQUEST_INTERVAL_MS - elapsed);
  if (waitFor > 0) await sleep(waitFor);
  lastInfiniteFlightRequestAt = Date.now();
}

async function fetchInfiniteFlightUsers(search, apiKey) {
  for (let attempt = 1; attempt <= IF_MAX_ATTEMPTS; attempt += 1) {
    await throttleInfiniteFlightRequest();

    let response;
    try {
      response = await fetch(IF_USERS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(search),
        signal: AbortSignal.timeout(IF_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt === IF_MAX_ATTEMPTS) throw error;
      await sleep(attempt * 1_000);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt === IF_MAX_ATTEMPTS) {
        throw new Error(
          `Infinite Flight user lookup failed with HTTP ${response.status}`,
        );
      }

      const retryAfter = retryAfterMilliseconds(
        response.headers.get("retry-after"),
      );
      await sleep(Math.max(retryAfter, attempt * 2_000));
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `Infinite Flight user lookup failed with HTTP ${response.status}`,
      );
    }

    const payload = await response.json();
    if (Number(payload?.errorCode) !== 0) {
      throw new Error(
        `Infinite Flight user lookup returned error code ${String(payload?.errorCode)}`,
      );
    }

    if (!Array.isArray(payload.result)) {
      throw new Error("Infinite Flight user lookup returned an invalid result");
    }

    return payload.result
      .filter((user) => user && typeof user === "object")
      .map((user) => ({
        userId: stringValue(user.userId),
        discourseUsername: stringValue(user.discourseUsername),
        errorCode: Number(user.errorCode ?? 0),
      }))
      .filter((user) => user.userId && user.errorCode === 0);
  }

  return [];
}

async function fetchUsersInBatches(searchKey, values, apiKey) {
  const users = [];
  const uniqueValues = [
    ...new Map(values.map((value) => [normalized(value), value])).values(),
  ];

  for (const valuesBatch of chunk(uniqueValues, IF_BATCH_SIZE)) {
    users.push(
      ...(await fetchInfiniteFlightUsers(
        { [searchKey]: valuesBatch },
        apiKey,
      )),
    );
  }

  return users;
}

function databaseConfiguration() {
  const sslCa = process.env.DB_SSL_CA?.replace(/\\n/g, "\n");
  const rejectUnauthorized =
    process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" || Boolean(sslCa);
  const port = Number(process.env.DB_PORT || 3306);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("DB_PORT must be a valid TCP port");
  }

  return {
    host: requiredEnvironment("DB_HOST"),
    user: requiredEnvironment("DB_USER"),
    password: requiredEnvironment("DB_PASSWORD"),
    database: requiredEnvironment("DB_NAME"),
    port,
    ssl: {
      rejectUnauthorized,
      ...(sslCa ? { ca: sslCa } : {}),
    },
  };
}

async function loadPilots(connection) {
  const [rows] = await connection.query(`
    SELECT id, callsign, ifc, ifuserid
    FROM pilots
    ORDER BY id ASC
  `);

  return rows.map((row) => ({
    id: Number(row.id),
    callsign: stringValue(row.callsign),
    ifc: stringValue(row.ifc),
    ifuserid: stringValue(row.ifuserid),
    originalIfc: row.ifc ?? null,
    originalIfUserId: row.ifuserid ?? null,
  }));
}

function buildPlans(pilots, usersById, usersByUsername) {
  return pilots.map((pilot) => {
    const storedId = stringValue(pilot.ifuserid);
    const storedUsername = stringValue(pilot.ifc);
    const userFromId = isUuid(storedId)
      ? usersById.get(normalized(storedId))
      : null;
    const userFromUsername = userFromId
      ? null
      : usersByUsername.get(normalized(storedUsername));
    const resolvedUser = userFromId || userFromUsername || null;

    if (!resolvedUser) {
      return {
        pilot,
        status: "unresolved",
        source: null,
        targetIfc: storedUsername,
        targetIfUserId: storedId,
        changed: false,
        conflict: false,
      };
    }

    const targetIfc = resolvedUser.discourseUsername || storedUsername;
    const targetIfUserId = resolvedUser.userId;

    return {
      pilot,
      status:
        targetIfc !== storedUsername || targetIfUserId !== storedId
          ? "update"
          : "verified",
      source: userFromId ? "id" : "username",
      targetIfc,
      targetIfUserId,
      changed:
        targetIfc !== storedUsername || targetIfUserId !== storedId,
      conflict: false,
    };
  });
}

function markConflicts(allPilots, plans) {
  const planByPilotId = new Map(plans.map((plan) => [plan.pilot.id, plan]));
  const projected = allPilots.map((pilot) => {
    const plan = planByPilotId.get(pilot.id);
    return {
      id: pilot.id,
      ifc: plan?.targetIfc ?? pilot.ifc,
      ifuserid: plan?.targetIfUserId ?? pilot.ifuserid,
    };
  });

  const ids = new Map();
  const usernames = new Map();

  for (const pilot of projected) {
    const userIdKey = normalized(pilot.ifuserid);
    const usernameKey = normalized(pilot.ifc);

    if (userIdKey) {
      const owners = ids.get(userIdKey) || [];
      owners.push(pilot.id);
      ids.set(userIdKey, owners);
    }

    if (usernameKey) {
      const owners = usernames.get(usernameKey) || [];
      owners.push(pilot.id);
      usernames.set(usernameKey, owners);
    }
  }

  const conflictingPilotIds = new Set();
  for (const owners of [...ids.values(), ...usernames.values()]) {
    if (owners.length > 1) owners.forEach((id) => conflictingPilotIds.add(id));
  }

  for (const plan of plans) {
    plan.conflict = conflictingPilotIds.has(plan.pilot.id);
  }
}

function describePlan(plan) {
  const pilotLabel = `#${plan.pilot.id} ${plan.pilot.callsign || "No callsign"}`;

  if (plan.conflict) {
    return `[conflict] ${pilotLabel}: ${plan.targetIfc || "No IFC username"} (${plan.targetIfUserId || "No IF user ID"}) is assigned to another pilot`;
  }

  if (plan.status === "unresolved") {
    return `[unresolved] ${pilotLabel}: ID "${plan.pilot.ifuserid || "missing"}" and username "${plan.pilot.ifc || "missing"}" could not be verified`;
  }

  if (plan.status === "verified") {
    return `[verified] ${pilotLabel}: ${plan.targetIfc} (${plan.targetIfUserId})`;
  }

  const changes = [];
  if (plan.targetIfUserId !== plan.pilot.ifuserid) {
    changes.push(
      `user ID ${plan.pilot.ifuserid || "missing"} -> ${plan.targetIfUserId}`,
    );
  }
  if (plan.targetIfc !== plan.pilot.ifc) {
    changes.push(
      `username ${plan.pilot.ifc || "missing"} -> ${plan.targetIfc}`,
    );
  }

  return `[update:${plan.source}] ${pilotLabel}: ${changes.join(", ")}`;
}

async function applyPlans(connection, plans) {
  const changes = plans.filter((plan) => plan.changed && !plan.conflict);
  if (changes.length === 0) return 0;

  await connection.beginTransaction();
  try {
    for (const plan of changes) {
      const [result] = await connection.execute(
        `
          UPDATE pilots
          SET ifc = ?, ifuserid = ?
          WHERE id = ?
            AND ifc <=> ?
            AND ifuserid <=> ?
        `,
        [
          plan.targetIfc,
          plan.targetIfUserId,
          plan.pilot.id,
          plan.pilot.originalIfc,
          plan.pilot.originalIfUserId,
        ],
      );

      if (result.affectedRows !== 1) {
        throw new Error(
          `Pilot #${plan.pilot.id} changed after the audit; no updates were committed`,
        );
      }
    }

    await connection.commit();
    return changes.length;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const apiKey = requiredEnvironment("IF_API");
  const connection = await mysql.createConnection(databaseConfiguration());

  try {
    const allPilots = await loadPilots(connection);
    const pilots = options.pilotId
      ? allPilots.filter((pilot) => pilot.id === options.pilotId)
      : allPilots;

    if (pilots.length === 0) {
      throw new Error(
        options.pilotId
          ? `Pilot #${options.pilotId} was not found`
          : "No pilots were found",
      );
    }

    console.log(
      `${options.apply ? "Applying" : "Dry-running"} IFC identity sync for ${pilots.length} pilot${pilots.length === 1 ? "" : "s"}...`,
    );

    const storedIds = pilots
      .map((pilot) => pilot.ifuserid)
      .filter(isUuid);
    const usersFromIds = await fetchUsersInBatches(
      "userIds",
      storedIds,
      apiKey,
    );
    const usersById = new Map(
      usersFromIds.map((user) => [normalized(user.userId), user]),
    );

    const fallbackPilots = pilots.filter(
      (pilot) => !usersById.has(normalized(pilot.ifuserid)),
    );
    const fallbackUsernames = fallbackPilots
      .map((pilot) => pilot.ifc)
      .filter(Boolean);
    const usersFromUsernames = await fetchUsersInBatches(
      "discourseNames",
      fallbackUsernames,
      apiKey,
    );
    const usersByUsername = new Map(
      usersFromUsernames
        .filter((user) => user.discourseUsername)
        .map((user) => [normalized(user.discourseUsername), user]),
    );

    const plans = buildPlans(pilots, usersById, usersByUsername);
    markConflicts(allPilots, plans);

    plans.forEach((plan) => console.log(describePlan(plan)));

    const updates = plans.filter((plan) => plan.changed && !plan.conflict);
    const unresolved = plans.filter(
      (plan) => plan.status === "unresolved" && !plan.conflict,
    );
    const conflicts = plans.filter((plan) => plan.conflict);
    const verified = plans.filter(
      (plan) => plan.status === "verified" && !plan.conflict,
    );

    let applied = 0;
    if (options.apply) {
      applied = await applyPlans(connection, plans);
    }

    console.log("");
    console.log(
      `Summary: ${verified.length} verified, ${updates.length} update${updates.length === 1 ? "" : "s"}, ${unresolved.length} unresolved, ${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}.`,
    );
    console.log(
      options.apply
        ? `Committed ${applied} pilot update${applied === 1 ? "" : "s"}.`
        : "Dry run only; rerun with --apply to commit the listed updates.",
    );

    if (unresolved.length > 0 || conflicts.length > 0) {
      process.exitCode = 2;
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(
    `IFC identity sync failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
