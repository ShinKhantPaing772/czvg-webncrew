import { models } from "@/lib/models";

const SECONDS_PER_HOUR = 3600;

/** Converts a pilot's transfer hours (whole hours from a previous VA) to seconds. */
export function transferHoursToSeconds(transhours: unknown) {
  const hours = Number(transhours);
  return Number.isFinite(hours) && hours > 0
    ? Math.round(hours * SECONDS_PER_HOUR)
    : 0;
}

/**
 * The flight time that counts toward rank, aircraft unlocks and multiplier
 * access: approved PIREP time plus hours transferred from another VA.
 */
export async function getPilotRankTime(pilotId: number) {
  const [approvedSum, pilot] = await Promise.all([
    models.Pirep.sum("flighttime", { where: { pilotid: pilotId, status: 1 } }),
    models.Pilot.findByPk(pilotId, {
      attributes: ["transhours"],
      raw: true,
    }),
  ]);

  const approvedSeconds = Number(approvedSum || 0);
  const transferSeconds = transferHoursToSeconds(pilot?.transhours);

  return {
    approvedSeconds,
    transferSeconds,
    rankSeconds: approvedSeconds + transferSeconds,
  };
}
