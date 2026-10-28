import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { MASTER_BADGES } from "./catalog";
import { resolveBadgeImageUrl } from "./image";

let columnsChecked = false;
let checkPromise: Promise<void> | null = null;
let catalogCheckTriggered = false;

/**
 * Safely fetches the list of column names actually present in the `awards` table.
 */
export async function getAwardExistingColumnNames(): Promise<Set<string>> {
  if (!sequelize || typeof (sequelize as any).query !== "function") {
    return new Set(["id", "name", "description", "imageurl", "featured"]);
  }
  try {
    const [columns] = await sequelize.query("SHOW COLUMNS FROM `awards`");
    return new Set(
      (columns as any[]).map((c) =>
        String(
          c.Field || c.field || c.COLUMN_NAME || c.column_name || "",
        ).toLowerCase(),
      ),
    );
  } catch {
    return new Set(["id", "name", "description", "imageurl", "featured"]);
  }
}

/**
 * Checks and auto-migrates missing columns in the `awards` table.
 * Idempotent, safe across all MySQL/MariaDB versions, and alters columns one by one.
 */
export async function ensureAwardColumnsExist(): Promise<void> {
  if (columnsChecked) return;
  if (checkPromise) return checkPromise;

  if (!sequelize || typeof (sequelize as any).query !== "function") {
    columnsChecked = true;
    return;
  }

  checkPromise = (async () => {
    try {
      const existingColNames = await getAwardExistingColumnNames();

      if (!existingColNames.has("name_zh")) {
        await sequelize
          .query("ALTER TABLE `awards` ADD COLUMN `name_zh` VARCHAR(255) NULL")
          .catch((e: any) =>
            console.warn("[Awards Auto-Migrate] name_zh note:", e?.message || e),
          );
      }
      if (!existingColNames.has("description_zh")) {
        await sequelize
          .query("ALTER TABLE `awards` ADD COLUMN `description_zh` TEXT NULL")
          .catch((e: any) =>
            console.warn(
              "[Awards Auto-Migrate] description_zh note:",
              e?.message || e,
            ),
          );
      }
      if (!existingColNames.has("category")) {
        await sequelize
          .query(
            "ALTER TABLE `awards` ADD COLUMN `category` VARCHAR(50) NOT NULL DEFAULT 'milestone'",
          )
          .catch((e: any) =>
            console.warn(
              "[Awards Auto-Migrate] category note:",
              e?.message || e,
            ),
          );
      }
      if (!existingColNames.has("criteria")) {
        // Try JSON type first, fallback to LONGTEXT for MariaDB / MySQL 5.6
        await sequelize
          .query("ALTER TABLE `awards` ADD COLUMN `criteria` JSON NULL")
          .catch(async () => {
            await sequelize
              .query("ALTER TABLE `awards` ADD COLUMN `criteria` LONGTEXT NULL")
              .catch(() => {});
          });
      }

      columnsChecked = true;
    } catch (err: any) {
      console.warn(
        "[Awards Auto-Migrate] Column check note (fallback will be used if needed):",
        err?.message || err,
      );
    } finally {
      checkPromise = null;
    }
  })();

  return checkPromise;
}

export interface SafeAwardRecord {
  id: number;
  name: string;
  name_zh?: string | null;
  nameZh?: string | null;
  description: string;
  description_zh?: string | null;
  descriptionZh?: string | null;
  imageurl: string;
  category: string;
  criteria?: any;
  featured: number | null;
}

function enrichAwardRecord(
  r: any,
  masterByName: Map<string, any>,
): SafeAwardRecord {
  const master = masterByName.get(String(r.name || "").trim().toLowerCase());
  const rawCriteria = r.criteria || master?.criteria || null;
  let parsedCriteria = rawCriteria;
  if (typeof rawCriteria === "string") {
    try {
      parsedCriteria = JSON.parse(rawCriteria);
    } catch {
      parsedCriteria = master?.criteria || null;
    }
  }

  const resolvedCategory =
    r.category && r.category !== "milestone"
      ? r.category
      : master?.category || r.category || "milestone";

  return {
    ...r,
    id: Number(r.id),
    name: r.name || master?.name || "",
    name_zh: r.name_zh || master?.nameZh || null,
    nameZh: r.name_zh || master?.nameZh || null,
    description: r.description || master?.description || "",
    description_zh: r.description_zh || master?.descriptionZh || null,
    descriptionZh: r.description_zh || master?.descriptionZh || null,
    imageurl: resolveBadgeImageUrl(r.imageurl || master?.imageurl || ""),
    category: resolvedCategory,
    criteria: parsedCriteria,
    featured: r.featured ?? master?.featured ?? null,
  };
}

/**
 * Safely fetches awards from database.
 * If columns like `name_zh` or `category` do not exist yet in database,
 * automatically falls back to base columns without throwing ER_BAD_FIELD_ERROR.
 * Automatically enriches missing metadata from MASTER_BADGES.
 */
export async function getSafeAwards(options?: {
  where?: any;
  order?: any;
  transaction?: any;
  attributes?: string[];
}): Promise<SafeAwardRecord[]> {
  await ensureAwardColumnsExist().catch(() => {});

  if (!catalogCheckTriggered) {
    catalogCheckTriggered = true;
    import("./sync")
      .then((m) => m.ensureAwardCatalogSeeded())
      .catch(() => {});
  }

  const masterByName = new Map(
    MASTER_BADGES.map((b) => [b.name.trim().toLowerCase(), b]),
  );

  const fullAttributes = options?.attributes || [
    "id",
    "name",
    "name_zh",
    "description",
    "description_zh",
    "imageurl",
    "category",
    "criteria",
    "featured",
  ];

  try {
    const rows = (await models.Award.findAll({
      where: options?.where,
      attributes: fullAttributes,
      order: options?.order || [
        ["category", "ASC"],
        ["id", "ASC"],
      ],
      raw: true,
      transaction: options?.transaction,
    })) as any[];

    return rows.map((r) => enrichAwardRecord(r, masterByName));
  } catch (err: any) {
    const isBadFieldError =
      err?.name === "SequelizeDatabaseError" &&
      (err?.original?.code === "ER_BAD_FIELD_ERROR" ||
        err?.parent?.code === "ER_BAD_FIELD_ERROR" ||
        String(err?.message || "").includes("Unknown column"));

    if (isBadFieldError) {
      console.warn(
        "[Awards] Extended columns missing in database table 'awards'. Safely falling back to base columns with catalog enrichment.",
      );

      const baseRows = (await models.Award.findAll({
        where: options?.where,
        attributes: ["id", "name", "description", "imageurl", "featured"],
        order: [["id", "ASC"]],
        raw: true,
        transaction: options?.transaction,
      })) as any[];

      return baseRows.map((r) => enrichAwardRecord(r, masterByName));
    }

    throw err;
  }
}
