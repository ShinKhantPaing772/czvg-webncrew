import { models } from "@/lib/models";
import { getPilotRankTime } from "@/lib/pilot-flight-time";

export type AircraftRequirements = {
  rankreq?: number | null;
  awardreq?: number | null;
};

export async function canPilotUseAircraft(
  pilotId: number,
  requirements: AircraftRequirements,
) {
  const rankRequired = Number(requirements.rankreq) || null;
  const awardRequired = Number(requirements.awardreq) || null;

  if (!rankRequired && !awardRequired) return false;

  const [rankSeconds, requiredRank, awardGrant] = await Promise.all([
    rankRequired
      ? getPilotRankTime(pilotId).then((time) => time.rankSeconds)
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
      rankSeconds >= Number(requiredRank.timereq),
  );
  const hasAward = Boolean(awardRequired && awardGrant);

  return meetsRank || hasAward;
}
