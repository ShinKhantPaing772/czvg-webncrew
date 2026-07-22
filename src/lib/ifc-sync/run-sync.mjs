import mysql from "mysql2/promise";
import { parseOptions, printUsage } from "./cli-options.mjs";
import {
  applyPlans,
  databaseConfiguration,
  loadPilots,
} from "./database.mjs";
import { ensureApiCacheTable } from "./cache.mjs";
import { fetchUsersInBatches } from "./infinite-flight.mjs";
import { buildPlans, describePlan, markConflicts } from "./plans.mjs";
import { isUuid, normalized, requiredEnvironment } from "./values.mjs";

export async function runSync(argv) {
  const options = parseOptions(argv);
  if (options.help) {
    printUsage();
    return 0;
  }

  const apiKey = requiredEnvironment("IF_API");
  const connection = await mysql.createConnection(databaseConfiguration());

  try {
    await ensureApiCacheTable(connection);
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

    const storedIds = pilots.map((pilot) => pilot.ifuserid).filter(isUuid);
    const usersFromIds = await fetchUsersInBatches(
      "userIds",
      storedIds,
      apiKey,
      connection,
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
      connection,
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

    const applied = options.apply
      ? await applyPlans(connection, plans)
      : 0;

    console.log("");
    console.log(
      `Summary: ${verified.length} verified, ${updates.length} update${updates.length === 1 ? "" : "s"}, ${unresolved.length} unresolved, ${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}.`,
    );
    console.log(
      options.apply
        ? `Committed ${applied} pilot update${applied === 1 ? "" : "s"}.`
        : "Dry run only; rerun with --apply to commit the listed updates.",
    );

    return unresolved.length > 0 || conflicts.length > 0 ? 2 : 0;
  } finally {
    await connection.end();
  }
}
