import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { MASTER_BADGES } from "./catalog";
import { evaluateAndGrantAwards } from "./evaluator";
import { ensureAwardColumnsExist } from "./columns";

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

  let createdCount = 0;
  let updatedCount = 0;

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
      await existing.update(payload);
      updatedCount++;
    } else {
      await models.Award.create(payload);
      createdCount++;
    }
  }

  return {
    createdCount,
    updatedCount,
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
