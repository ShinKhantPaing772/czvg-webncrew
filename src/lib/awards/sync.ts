import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { MASTER_BADGES } from "./catalog";
import { evaluateAndGrantAwards } from "./evaluator";
import { ensureAwardColumnsExist } from "./columns";

let catalogSeeded = false;
let seedPromise: Promise<void> | null = null;

/**
 * Checks and automatically synchronizes the master 102 badges catalog into the database.
 * Executes once per process/instance, ensuring production zero-touch auto-seeding.
 */
export async function ensureAwardCatalogSeeded(): Promise<void> {
  if (catalogSeeded) return;
  if (seedPromise) return seedPromise;

  if (
    !sequelize ||
    typeof (sequelize as any).query !== "function" ||
    typeof (models.Award as any)?.count !== "function"
  ) {
    catalogSeeded = true;
    return;
  }

  seedPromise = (async () => {
    try {
      await ensureAwardColumnsExist().catch(() => {});
      const count = await models.Award.count();

      // If database has fewer awards than master catalog, auto-seed missing badges
      if (count < MASTER_BADGES.length) {
        console.log(
          `[Awards Auto-Seed] Database currently has ${count} awards (< ${MASTER_BADGES.length}). Auto-syncing master badges catalog...`,
        );
        await syncAwardsCatalogToDatabase();
        console.log(
          `[Awards Auto-Seed] Master badges catalog auto-synced successfully (${MASTER_BADGES.length} total).`,
        );
      }
      catalogSeeded = true;
    } catch (err: any) {
      console.warn(
        "[Awards Auto-Seed] Notice during auto-seed check (non-fatal):",
        err?.message || err,
      );
    } finally {
      seedPromise = null;
    }
  })();

  return seedPromise;
}

export async function syncAwardsCatalogToDatabase(): Promise<{
  createdCount: number;
  updatedCount: number;
  totalCatalog: number;
}> {
  await ensureAwardColumnsExist().catch(() => {});

  const existingAwards = (await models.Award.findAll({
    attributes: [
      "id",
      "name",
      "name_zh",
      "description",
      "description_zh",
      "imageurl",
      "category",
      "criteria",
      "featured",
    ],
  })) as any[];

  const existingByName = new Map<string, any>();
  for (const award of existingAwards) {
    if (award.name) {
      existingByName.set(String(award.name).trim().toLowerCase(), award);
    }
  }

  const toCreate: any[] = [];
  const updatePromises: Promise<any>[] = [];

  for (const item of MASTER_BADGES) {
    const key = item.name.trim().toLowerCase();
    const existing = existingByName.get(key);

    const payload = {
      name: item.name,
      name_zh: item.nameZh,
      description: item.description,
      description_zh: item.descriptionZh,
      imageurl: item.imageurl,
      category: item.category,
      criteria: item.criteria,
      featured: item.featured,
    };

    if (existing) {
      const needsUpdate =
        existing.name_zh !== item.nameZh ||
        existing.description_zh !== item.descriptionZh ||
        existing.imageurl !== item.imageurl ||
        existing.category !== item.category ||
        JSON.stringify(existing.criteria) !== JSON.stringify(item.criteria);

      if (needsUpdate) {
        updatePromises.push(existing.update(payload));
      }
    } else {
      toCreate.push(payload);
    }
  }

  if (toCreate.length > 0) {
    if (typeof (models.Award as any).bulkCreate === "function") {
      await models.Award.bulkCreate(toCreate);
    } else {
      for (const item of toCreate) {
        await models.Award.create(item);
      }
    }
  }

  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
  }

  return {
    createdCount: toCreate.length,
    updatedCount: updatePromises.length,
    totalCatalog: MASTER_BADGES.length,
  };
}

export async function backfillAwardsToAllPilots(): Promise<{
  pilotsChecked: number;
  affectedPilots: number;
  totalNewGrants: number;
}> {
  const pilots = (await models.Pilot.findAll({
    attributes: ["id", "callsign", "name"],
    order: [["id", "ASC"]],
    raw: true,
  })) as any[];

  let affectedPilots = 0;
  let totalNewGrants = 0;

  for (const pilot of pilots) {
    try {
      const result = await evaluateAndGrantAwards(Number(pilot.id));
      if (result.grantedAwards.length > 0) {
        affectedPilots++;
        totalNewGrants += result.grantedAwards.length;
      }
    } catch (err) {
      console.error(`[Backfill] Error evaluating pilot #${pilot.id}:`, err);
    }
  }

  return {
    pilotsChecked: pilots.length,
    affectedPilots,
    totalNewGrants,
  };
}

export async function syncAndBackfillAwards(): Promise<{
  sync: { createdCount: number; updatedCount: number; totalCatalog: number };
  backfill: {
    pilotsChecked: number;
    affectedPilots: number;
    totalNewGrants: number;
  };
}> {
  const sync = await syncAwardsCatalogToDatabase();
  const backfill = await backfillAwardsToAllPilots();
  return { sync, backfill };
}
