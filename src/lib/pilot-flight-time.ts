import { models } from "@/lib/models";

/**
 * A pilot's transfer flight time (time flown at a previous VA) in seconds.
 * Despite its name, `pilots.transhours` holds seconds, like
 * `pireps.flighttime` and `ranks.timereq`.
 */
export function transferTimeSeconds(transhours: unknown) {
  const seconds = Number(transhours);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
}

/**
 * The flight time that counts toward rank, aircraft unlocks and multiplier
 * access: approved PIREP time plus transfer flight time.
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
  const transferSeconds = transferTimeSeconds(pilot?.transhours);

  return {
    approvedSeconds,
    transferSeconds,
    rankSeconds: approvedSeconds + transferSeconds,
  };
}
