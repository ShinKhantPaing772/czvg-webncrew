import { models } from "@/lib/models";

export type AircraftRequirements = {
  rankreq?: number | null;
  awardreq?: number | null;
};

export function meetsAircraftRequirements(
  requirements: AircraftRequirements,
  eligibleRankIds: number[],
  ownedAwardIds: number[],
) {
  const rankRequired = Number(requirements.rankreq) || null;
  const awardRequired = Number(requirements.awardreq) || null;

  if (!rankRequired && !awardRequired) return false;

  return Boolean(
    (rankRequired && eligibleRankIds.includes(rankRequired)) ||
      (awardRequired && ownedAwardIds.includes(awardRequired)),
  );
}

export async function canPilotUseAircraft(
  pilotId: number,
  requirements: AircraftRequirements,
) {
  const rankRequired = Number(requirements.rankreq) || null;
  const awardRequired = Number(requirements.awardreq) || null;

  if (!rankRequired && !awardRequired) return false;

  const [approvedFlightSeconds, requiredRank, awardGrant] = await Promise.all([
    rankRequired
      ? models.Pirep.sum("flighttime", {
          where: { pilotid: pilotId, status: 1 },
        })
      : Promise.resolve(0),
    rankRequired
      ? models.Rank.findByPk(rankRequired, { attributes: ["timereq"] })
      : Promise.resolve(null),
    awardRequired
      ? models.AwardGranted.findOne({
          where: { pilotid: pilotId, awardid: awardRequired },
          attributes: ["id"],
        })
      : Promise.resolve(null),
  ]);

  const meetsRank = Boolean(
    rankRequired &&
      requiredRank &&
      Number(approvedFlightSeconds || 0) >= Number(requiredRank.timereq),
  );
  const hasAward = Boolean(awardRequired && awardGrant);

  return meetsRank || hasAward;
}
