import sequelize from "@/lib/database";
import { models } from "@/lib/models";

let columnsChecked = false;
let checkPromise: Promise<void> | null = null;
let catalogCheckTriggered = false;

/**
 * Checks and auto-migrates missing columns in the `awards` table.
 * Idempotent, safe across all MySQL/MariaDB versions, and executes once per process.
 */
export async function ensureAwardColumnsExist(): Promise<void> {
  if (columnsChecked) return;
  if (checkPromise) return checkPromise;

  // If sequelize or sequelize.query is not available (e.g. in mocked test environments), skip
  if (!sequelize || typeof (sequelize as any).query !== "function") {
    columnsChecked = true;
    return;
  }

  checkPromise = (async () => {
    try {
      const [columns] = await sequelize.query("SHOW COLUMNS FROM `awards`");
      const existingColNames = new Set(
        (columns as any[]).map((c) => String(c.Field).toLowerCase()),
      );

      const alters: string[] = [];
      if (!existingColNames.has("name_zh")) {
        alters.push("ADD COLUMN `name_zh` VARCHAR(255) NULL");
      }
      if (!existingColNames.has("description_zh")) {
        alters.push("ADD COLUMN `description_zh` TEXT NULL");
      }
      if (!existingColNames.has("category")) {
        alters.push(
          "ADD COLUMN `category` VARCHAR(50) NOT NULL DEFAULT 'milestone'",
        );
      }
      if (!existingColNames.has("criteria")) {
        alters.push("ADD COLUMN `criteria` JSON NULL");
      }

      if (alters.length > 0) {
        await sequelize.query(`ALTER TABLE \`awards\` ${alters.join(", ")}`);
        console.log(
          `[Awards Auto-Migrate] Added missing columns to 'awards': ${alters.join(", ")}`,
        );
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

/**
 * Safely fetches awards from database.
 * If columns like `name_zh` or `category` do not exist yet in database,
 * automatically falls back to base columns without throwing ER_BAD_FIELD_ERROR.
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

    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      name: r.name || "",
      name_zh: r.name_zh || null,
      nameZh: r.name_zh || null,
      description: r.description || "",
      description_zh: r.description_zh || null,
      descriptionZh: r.description_zh || null,
      imageurl: r.imageurl || "",
      category: r.category || "milestone",
      criteria: r.criteria || null,
      featured: r.featured ?? null,
    }));
  } catch (err: any) {
    const isBadFieldError =
      err?.name === "SequelizeDatabaseError" &&
      (err?.original?.code === "ER_BAD_FIELD_ERROR" ||
        err?.parent?.code === "ER_BAD_FIELD_ERROR" ||
        String(err?.message || "").includes("Unknown column"));

    if (isBadFieldError) {
      console.warn(
        "[Awards] Extended columns missing in database table 'awards'. Safely falling back to base columns.",
      );

      const baseRows = (await models.Award.findAll({
        where: options?.where,
        attributes: ["id", "name", "description", "imageurl", "featured"],
        order: [["id", "ASC"]],
        raw: true,
        transaction: options?.transaction,
      })) as any[];

      return baseRows.map((r) => ({
        ...r,
        id: Number(r.id),
        name: r.name || "",
        name_zh: null,
        nameZh: null,
        description: r.description || "",
        description_zh: null,
        descriptionZh: null,
        imageurl: r.imageurl || "",
        category: "milestone",
        criteria: null,
        featured: r.featured ?? null,
      }));
    }

    throw err;
  }
}
