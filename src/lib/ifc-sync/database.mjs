import { requiredEnvironment, stringValue } from "./values.mjs";
import { databaseSslOptions } from "../database-ssl.mjs";

export function databaseConfiguration() {
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
    ssl: databaseSslOptions(),
  };
}

export async function loadPilots(connection) {
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

export async function applyPlans(connection, plans) {
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
