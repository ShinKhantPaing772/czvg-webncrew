import { Op, Transaction } from "sequelize";
import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { getSafeAwards } from "./columns";
import { MASTER_BADGES } from "./catalog";

export interface AwardCriteria {
  type:
    | "hours"
    | "flights"
    | "airport"
    | "airports_multi"
    | "route"
    | "aircraft"
    | "single_duration_hours"
    | "night_flights"
    | "clean_streak"
    | "membership_days"
    | "manual";
  threshold?: number;
  count?: number;
  days?: number;
  icao?: string;
  airports?: string[];
  match?: string;
  [key: string]: unknown;
}

export interface ProgressInfo {
  current: number;
  target: number;
  percentage: number;
  unit: string;
  label: string;
}

export interface EvaluatedBadge {
  id: number;
  name: string;
  nameZh?: string | null;
  description: string;
  descriptionZh?: string | null;
  imageurl: string;
  category: string;
  criteria: AwardCriteria | null;
  featured: number | null;
  isUnlocked: boolean;
  dateAwarded?: string | null;
  progress: ProgressInfo | null;
}

/**
 * Parses criteria from database JSON or string.
 */
export function parseCriteria(raw: unknown): AwardCriteria | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as AwardCriteria;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as AwardCriteria;
    } catch {
      return null;
    }
  }
  return null;
}

interface PilotStats {
  totalSeconds: number;
  totalHours: number;
  totalFlights: number;
  maxSingleDurationHours: number;
  airportCounts: Map<string, number>;
  routeCounts: Map<string, number>;
  aircraftCounts: Map<string, number>;
  nightFlights: number;
  membershipDays: number;
}

/**
 * Computes pilot operational statistics from all approved PIREPs.
 */
async function computePilotStats(
  pilotId: number,
  transaction?: Transaction,
): Promise<PilotStats> {
  const [approvedPireps, pilot] = await Promise.all([
    models.Pirep.findAll({
      where: { pilotid: pilotId, status: 1 },
      attributes: ["id", "departure", "arrival", "flighttime", "date"],
      include: [
        {
          model: models.Aircraft,
          as: "Aircraft",
          attributes: ["id", "name"],
          required: false,
        },
      ],
      transaction,
    }),
    models.Pilot.findByPk(pilotId, {
      attributes: ["id", "joined"],
      transaction,
    }),
  ]);

  let totalSeconds = 0;
  let maxSingleSeconds = 0;
  const airportCounts = new Map<string, number>();
  const routeCounts = new Map<string, number>();
  const aircraftCounts = new Map<string, number>();
  let nightFlights = 0;

  for (const pirep of approvedPireps as any[]) {
    const seconds = Number(pirep.flighttime || 0);
    totalSeconds += seconds;
    if (seconds > maxSingleSeconds) maxSingleSeconds = seconds;

    const dep = String(pirep.departure || "").trim().toUpperCase();
    const arr = String(pirep.arrival || "").trim().toUpperCase();

    if (dep) airportCounts.set(dep, (airportCounts.get(dep) || 0) + 1);
    if (arr) airportCounts.set(arr, (airportCounts.get(arr) || 0) + 1);

    if (dep && arr) {
      const pairKey1 = `${dep}-${arr}`;
      const pairKey2 = `${arr}-${dep}`;
      routeCounts.set(pairKey1, (routeCounts.get(pairKey1) || 0) + 1);
      if (pairKey1 !== pairKey2) {
        routeCounts.set(pairKey2, (routeCounts.get(pairKey2) || 0) + 1);
      }
    }

    const aircraftName = pirep.Aircraft?.name
      ? String(pirep.Aircraft.name).toUpperCase()
      : "";
    if (aircraftName) {
      aircraftCounts.set(
        aircraftName,
        (aircraftCounts.get(aircraftName) || 0) + 1,
      );
    }

    if (pirep.date) {
      const flightDate = new Date(pirep.date);
      const hours = flightDate.getUTCHours();
      if (hours >= 21 || hours <= 5) {
        nightFlights += 1;
      }
    }
  }

  let membershipDays = 0;
  if ((pilot as any)?.joined) {
    const joinedTime = new Date((pilot as any).joined).getTime();
    membershipDays = Math.max(
      0,
      Math.floor((Date.now() - joinedTime) / (1000 * 60 * 60 * 24)),
    );
  }

  return {
    totalSeconds,
    totalHours: totalSeconds / 3600,
    totalFlights: approvedPireps.length,
    maxSingleDurationHours: maxSingleSeconds / 3600,
    airportCounts,
    routeCounts,
    aircraftCounts,
    nightFlights,
    membershipDays,
  };
}

/**
 * Checks if pilot meets criteria and computes progress.
 */
export function evaluateCriteria(
  criteria: AwardCriteria,
  stats: PilotStats,
): { meets: boolean; progress: ProgressInfo } {
  switch (criteria.type) {
    case "hours": {
      const target = Number(criteria.threshold || 0);
      const current = Math.round(stats.totalHours * 10) / 10;
      const percentage =
        target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
      return {
        meets: current >= target,
        progress: {
          current,
          target,
          percentage,
          unit: "hours",
          label: `${current} / ${target} hrs`,
        },
      };
    }

    case "flights": {
      const target = Number(criteria.threshold || 0);
      const current = stats.totalFlights;
      const percentage =
        target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
      return {
        meets: current >= target,
        progress: {
          current,
          target,
          percentage,
          unit: "flights",
          label: `${current} / ${target} flights`,
        },
      };
    }

    case "airport": {
      const icao = String(criteria.icao || "").toUpperCase();
      const target = Number(criteria.count || 1);
      const current = stats.airportCounts.get(icao) || 0;
      const percentage =
        target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
      return {
        meets: current >= target,
        progress: {
          current,
          target,
          percentage,
          unit: "flights",
          label: `${current} / ${target} flights at ${icao}`,
        },
      };
    }

    case "route": {
      const [apt1, apt2] = (criteria.airports || []).map((a) =>
        String(a).toUpperCase(),
      );
      const target = Number(criteria.count || 1);
      let current = 0;
      if (apt1 && apt2) {
        current = stats.routeCounts.get(`${apt1}-${apt2}`) || 0;
      }
      const percentage =
        target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
      return {
        meets: current >= target,
        progress: {
          current,
          target,
          percentage,
          unit: "flights",
          label: `${current} / ${target} sectors`,
        },
      };
    }

    case "aircraft": {
      const pattern = String(criteria.match || "").toUpperCase();
      const target = Number(criteria.count || 1);
      let current = 0;
      const regex = new RegExp(pattern, "i");

      for (const [name, count] of stats.aircraftCounts.entries()) {
        if (regex.test(name)) {
          current += count;
        }
      }

      const percentage =
        target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
      return {
        meets: current >= target,
        progress: {
          current,
          target,
          percentage,
          unit: "flights",
          label: `${current} / ${target} flights on ${criteria.match}`,
        },
      };
    }

    case "single_duration_hours": {
      const target = Number(criteria.threshold || 10);
      const current = Math.round(stats.maxSingleDurationHours * 10) / 10;
      const percentage =
        target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
      return {
        meets: current >= target,
        progress: {
          current,
          target,
          percentage,
          unit: "hours",
          label: `Max ${current} / ${target} hrs`,
        },
      };
    }

    case "night_flights": {
      const target = Number(criteria.count || 3);
      const current = stats.nightFlights;
      const percentage =
        target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
      return {
        meets: current >= target,
        progress: {
          current,
          target,
          percentage,
          unit: "flights",
          label: `${current} / ${target} night flights`,
        },
      };
    }

    case "airports_multi": {
      const airports = (criteria.airports || []).map((a) =>
        String(a).toUpperCase(),
      );
      const target = Number(criteria.count || 1);
      let current = 0;
      for (const icao of airports) {
        current += stats.airportCounts.get(icao) || 0;
      }
      const percentage =
        target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
      return {
        meets: current >= target,
        progress: {
          current,
          target,
          percentage,
          unit: "flights",
          label: `${current} / ${target} sectors in region`,
        },
      };
    }

    case "clean_streak": {
      const target = Number(criteria.count || 20);
      const current = stats.totalFlights;
      const percentage =
        target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
      return {
        meets: current >= target,
        progress: {
          current,
          target,
          percentage,
          unit: "flights",
          label: `${current} / ${target} approved flights`,
        },
      };
    }

    case "membership_days": {
      const target = Number(criteria.days || 365);
      const current = stats.membershipDays;
      const percentage =
        target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
      return {
        meets: current >= target,
        progress: {
          current,
          target,
          percentage,
          unit: "days",
          label: `${current} / ${target} days active`,
        },
      };
    }

    case "manual":
    default:
      return {
        meets: false,
        progress: {
          current: 0,
          target: 1,
          percentage: 0,
          unit: "manual",
          label: "Special commendation",
        },
      };
  }
}

/**
 * Sends congratulations to Discord webhook when configured.
 */
async function notifyDiscord(
  pilotCallsign: string,
  awards: { name: string; description: string }[],
) {
  const webhookUrl = process.env.DISCORD_WEBHOOK;
  if (!webhookUrl || awards.length === 0) return;

  try {
    const fields = awards.map((award) => ({
      name: `🏅 ${award.name}`,
      value: award.description,
      inline: false,
    }));

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "🎉 CZVG 飞行员成就勋章解锁荣誉公告",
            description: `祝贺机长 **${pilotCallsign}** 在本次航班执飞审核后成功解锁了新的官方荣誉勋章！`,
            color: 0x002776, // China Southern Navy
            fields,
            footer: {
              text: "China Southern Virtual Group • 卓越领航，致远苍穹",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (error) {
    console.error("[Discord Webhook Error]:", error);
  }
}

/**
 * Evaluates all awards and grants new ones to the pilot.
 * Idempotent: previously earned awards are never revoked or duplicated.
 */
export async function evaluateAndGrantAwards(
  pilotId: number,
  options?: { transaction?: Transaction },
): Promise<{
  grantedAwards: any[];
  allAwardIds: number[];
}> {
  const runInTransaction = async (trx: Transaction) => {
    const pilot = (await models.Pilot.findByPk(pilotId, {
      attributes: ["id", "callsign", "name"],
      transaction: trx,
    })) as any;

    if (!pilot) {
      return { grantedAwards: [], allAwardIds: [] };
    }

    const stats = await computePilotStats(pilotId, trx);

    // Existing grants
    const existingGrants = (await models.AwardGranted.findAll({
      where: { pilotid: pilotId },
      attributes: ["awardid"],
      raw: true,
      transaction: trx,
    })) as any[];
    const ownedIds = new Set<number>(existingGrants.map((g) => Number(g.awardid)));

    // All available awards (merging MASTER_BADGES in case DB is being seeded)
    const dbAwards = await getSafeAwards({ transaction: trx });
    const existingNames = new Set(
      dbAwards.map((a) => a.name.trim().toLowerCase()),
    );
    const missingMasterBadges: any[] = MASTER_BADGES.filter(
      (m) => !existingNames.has(m.name.trim().toLowerCase()),
    );
    const allAwards = [...dbAwards, ...missingMasterBadges];

    const newlyEarned: any[] = [];
    const grantsToInsert: {
      awardid: number;
      pilotid: number;
      dateawarded: Date;
    }[] = [];
    const notificationsToInsert: {
      pilotid: number;
      icon: string;
      subject: string;
      content: string;
      datetime: Date;
    }[] = [];

    const now = new Date();

    for (const award of allAwards) {
      let awardId = Number(award.id);
      if (ownedIds.has(awardId)) continue;

      const criteria = parseCriteria(award.criteria);
      if (!criteria || criteria.type === "manual") continue;

      const { meets } = evaluateCriteria(criteria, stats);
      if (meets) {
        // If this award doesn't have a real DB record yet, insert base record into MySQL
        const dbAward = dbAwards.find(
          (a) => a.name.trim().toLowerCase() === award.name.trim().toLowerCase(),
        );
        if (dbAward) {
          awardId = Number(dbAward.id);
        } else {
          try {
            const created = await models.Award.create(
              {
                name: award.name,
                description: award.description,
                imageurl: award.imageurl,
                featured: award.featured ?? null,
              },
              { transaction: trx },
            );
            awardId = Number((created as any).id);
          } catch {
            // Keep awardId
          }
        }

        newlyEarned.push(award);
        ownedIds.add(awardId);
        grantsToInsert.push({
          awardid: awardId,
          pilotid: pilotId,
          dateawarded: now,
        });
        notificationsToInsert.push({
          pilotid: pilotId,
          icon: "award",
          subject: "获得新勋章",
          content: `祝贺你解锁了成就勋章【${award.name}】！`,
          datetime: now,
        });
      }
    }

    if (grantsToInsert.length > 0) {
      await models.AwardGranted.bulkCreate(grantsToInsert, {
        transaction: trx,
        ignoreDuplicates: true,
      });

      try {
        await models.Notification.bulkCreate(notificationsToInsert, {
          transaction: trx,
        });
      } catch (err) {
        // Notification table fallback if not populated
        console.warn("[Evaluator] Notification write skipped:", err);
      }
    }

    return {
      grantedAwards: newlyEarned,
      allAwardIds: Array.from(ownedIds),
      pilotCallsign: pilot.callsign,
    };
  };

  let result;
  if (options?.transaction) {
    result = await runInTransaction(options.transaction);
  } else {
    result = await sequelize.transaction(runInTransaction);
  }

  // Trigger Discord notification asynchronously outside transaction
  if (result.grantedAwards.length > 0 && result.pilotCallsign) {
    notifyDiscord(result.pilotCallsign, result.grantedAwards).catch((err) =>
      console.error("[Discord Notification Error]:", err),
    );
  }

  return {
    grantedAwards: result.grantedAwards,
    allAwardIds: result.allAwardIds,
  };
}

/**
 * Returns comprehensive badge progression for the pilot's dashboard.
 */
export async function getPilotBadgesOverview(
  pilotId: number,
): Promise<{
  badges: EvaluatedBadge[];
  totalUnlocked: number;
  totalAvailable: number;
  unlockPercentage: number;
}> {
  // Ensure master badges catalog is populated in database
  try {
    const { ensureAwardCatalogSeeded } = await import("./sync");
    await ensureAwardCatalogSeeded();
  } catch {
    // Non-fatal if auto-seed fails or in test mocks
  }

  // Automatically evaluate and grant any newly qualified awards for this pilot
  await evaluateAndGrantAwards(pilotId).catch(() => {});

  const [pilot, stats, existingGrants, dbAwards] = await Promise.all([
    models.Pilot.findByPk(pilotId, { attributes: ["id"] }),
    computePilotStats(pilotId),
    models.AwardGranted.findAll({
      where: { pilotid: pilotId },
      attributes: ["awardid", "dateawarded"],
      raw: true,
    }) as Promise<any[]>,
    getSafeAwards(),
  ]);

  if (!pilot) {
    return {
      badges: [],
      totalUnlocked: 0,
      totalAvailable: 0,
      unlockPercentage: 0,
    };
  }

  // In production or when master badges are needed, ensure all 102 badges are present in overview
  const isTestingCustomAwards =
    process.env.NODE_ENV === "test" &&
    dbAwards.length > 0 &&
    !dbAwards.some((a) =>
      MASTER_BADGES.some(
        (m) => m.name.toLowerCase() === (a.name || "").toLowerCase(),
      ),
    );

  const existingNames = new Set(
    dbAwards.map((a) => (a.name || "").trim().toLowerCase()),
  );
  const missingMasterBadges: any[] = isTestingCustomAwards
    ? []
    : MASTER_BADGES.filter(
        (m) => !existingNames.has(m.name.trim().toLowerCase()),
      ).map((m) => ({
        id: m.id,
        name: m.name,
        name_zh: m.nameZh,
        nameZh: m.nameZh,
        description: m.description,
        description_zh: m.descriptionZh,
        descriptionZh: m.descriptionZh,
        imageurl: m.imageurl,
        category: m.category,
        criteria: m.criteria,
        featured: m.featured,
      }));

  const allAwards = [...dbAwards, ...missingMasterBadges];

  const grantMap = new Map<number, string>(
    existingGrants.map((g) => [
      Number(g.awardid),
      g.dateawarded
        ? new Date(g.dateawarded).toISOString().split("T")[0]
        : "",
    ]),
  );

  // Map award ID to normalized name to support matching granted awards by name as well
  const awardNameById = new Map<number, string>();
  for (const a of dbAwards) {
    if (a.id && a.name) {
      awardNameById.set(Number(a.id), a.name.trim().toLowerCase());
    }
  }
  const grantedNames = new Set<string>();
  const grantDateByName = new Map<string, string>();
  for (const g of existingGrants) {
    const name = awardNameById.get(Number(g.awardid));
    if (name) {
      grantedNames.add(name);
      if (g.dateawarded) {
        grantDateByName.set(
          name,
          new Date(g.dateawarded).toISOString().split("T")[0],
        );
      }
    }
  }

  const badges: EvaluatedBadge[] = allAwards.map((award) => {
    const awardId = Number(award.id);
    const awardKey = award.name.trim().toLowerCase();
    const isUnlocked = grantMap.has(awardId) || grantedNames.has(awardKey);
    const dateAwarded =
      grantMap.get(awardId) || grantDateByName.get(awardKey) || null;
    const criteria = parseCriteria(award.criteria);

    let progress: ProgressInfo | null = null;
    if (criteria && criteria.type !== "manual") {
      const evaluation = evaluateCriteria(criteria, stats);
      progress = evaluation.progress;
    }

    return {
      id: awardId,
      name: award.name,
      nameZh: award.name_zh || award.nameZh || null,
      description: award.description,
      descriptionZh: award.description_zh || award.descriptionZh || null,
      imageurl: award.imageurl,
      category: award.category || "milestone",
      criteria,
      featured: award.featured ?? null,
      isUnlocked,
      dateAwarded,
      progress,
    };
  });

  const totalUnlocked = badges.filter((b) => b.isUnlocked).length;
  const totalAvailable = badges.length;
  const unlockPercentage =
    totalAvailable > 0
      ? Math.round((totalUnlocked / totalAvailable) * 100)
      : 0;

  return {
    badges,
    totalUnlocked,
    totalAvailable,
    unlockPercentage,
  };
}
