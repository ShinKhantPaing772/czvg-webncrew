import { Op, QueryTypes, Transaction } from "sequelize";
import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { canAccessCrewCenter } from "@/lib/pilot-status";
import { SchedulingError, validId } from "./policy";

const START_POLICY_OPTION = "live_scheduling_allow_unpublished_if_starts";
export type SchedulingSettings = { allowUnpublishedIfStarts: boolean };

/** Read on every departure; this operational policy must never use a memory cache. */
export async function getSchedulingSettings(transaction?: Transaction): Promise<SchedulingSettings> {
  const rows = await sequelize.query<{ value: string }>("SELECT value FROM options WHERE name = :name", {
    replacements: { name: START_POLICY_OPTION }, type: QueryTypes.SELECT, transaction,
  });
  let allowed = false;
  try {
    const value: unknown = JSON.parse(rows[0]?.value ?? "null");
    allowed = Boolean(value && typeof value === "object" && "allowUnpublishedIfStarts" in value && value.allowUnpublishedIfStarts === true);
  } catch { /* Missing or invalid configuration preserves the publication requirement. */ }
  return { allowUnpublishedIfStarts: allowed };
}

export async function changeSchedulingSettings(actorId: number, input: unknown): Promise<SchedulingSettings> {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).length !== 1 || !("allowUnpublishedIfStarts" in input) || typeof input.allowUnpublishedIfStarts !== "boolean") {
    throw new SchedulingError("Provide only allowUnpublishedIfStarts as a boolean");
  }
  const allowed = input.allowUnpublishedIfStarts;
  const id = validId(actorId, "Administrator");
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async transaction => {
    // Match flight starts so a disabling change cannot race past a stale policy read.
    const mutex = await sequelize.query<{ name: string }>("SELECT name FROM options WHERE name = 'live_scheduling_mutex' FOR UPDATE", { type: QueryTypes.SELECT, transaction });
    if (!mutex.length) throw new SchedulingError("Live scheduling needs its SQL migration. Apply migrations/20261002_live_scheduling.sql first.", 503);
    const pilot = await models.Pilot.findByPk(id, { attributes: ["status"], transaction, lock: transaction.LOCK.UPDATE });
    const permissions = await models.Permission.findAll({
      where: { userid: id, name: { [Op.in]: ["admin", "scheduling"] } }, attributes: ["name"], transaction, lock: transaction.LOCK.UPDATE,
    });
    if (!pilot || !canAccessCrewCenter(Number(pilot.status)) || !permissions.length) throw new SchedulingError("An active scheduling administrator is required to change this setting", 403);
    const previous = await getSchedulingSettings(transaction);
    // Global changes have no aircraft ID; keep the last change's actor and UTC
    // time with the policy rather than inventing a tail for the aircraft audit table.
    const value = JSON.stringify({ allowUnpublishedIfStarts: allowed, updatedBy: id, updatedAt: new Date().toISOString(), previousAllowUnpublishedIfStarts: previous.allowUnpublishedIfStarts });
    await sequelize.query("INSERT INTO options (name, value) VALUES (:name, :value) ON DUPLICATE KEY UPDATE value = VALUES(value)", {
      replacements: { name: START_POLICY_OPTION, value }, transaction,
    });
    return { allowUnpublishedIfStarts: allowed };
  });
}
