import { NextResponse } from "next/server";
import { models } from "@/lib/models";
import { formatFlightTime } from "@/lib/utils/time";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const pilotId = params.id;

    // Fetch ALL PIREPs for the pilot (regardless of status)
    const pireps = await models.Pirep.findAll({
      where: { pilotId },
      include: [
        {
          model: models.Aircraft,
          as: "Aircraft",
          attributes: ["id", "name", "liveryname"],
        },
        {
          model: models.PirepComment,
          as: "Comments",
          attributes: ["id", "userid", "content", "dateposted"],
          include: [
            {
              model: models.Pilot,
              as: "User",
              attributes: ["id", "callsign", "name"],
            },
          ],
        },
      ],
      attributes: [
        "id",
        "flightnum",
        "departure",
        "arrival",
        "flighttime",
        "date",
        "aircraftid",
        "fuelused",
        "multi",
        "status",
      ],
      order: [["date", "DESC"]],
    });

    // Format flight time for each PIREP (for display)
    const formattedPireps = pireps.map((pirep) => ({
      ...pirep.get(),
      flighttime: formatFlightTime(pirep.flighttime || 0),
    }));

    // Filter only APPROVED PIREPs (status = 1)
    const approvedPireps = pireps.filter((pirep) => pirep.status === 1);

    // Calculate total flight time using only approved PIREPs
    const totalSeconds = approvedPireps.reduce(
      (total, pirep) => total + (pirep.flighttime || 0),
      0,
    );

    // Fetch all ranks
    const ranks = await models.Rank.findAll({
      order: [["timereq", "ASC"]],
    });

    // Determine the pilot's rank based on total approved flight time
    let pilotRank = { id: 0, name: "Trainee", timereq: 0 }; // Default rank
    for (const rank of ranks) {
      if (totalSeconds >= rank.timereq) {
        pilotRank = rank.get();
      } else {
        break;
      }
    }

    // Calculate progress toward next rank
    let nextRank = null;
    let progressToNextRank = 100;

    const currentRankIndex = ranks.findIndex(
      (rank) => rank.id === pilotRank.id,
    );
    if (currentRankIndex < ranks.length - 1) {
      nextRank = ranks[currentRankIndex + 1].get();
      const remainingTime = nextRank.timereq - totalSeconds;
      const totalRankTime = nextRank.timereq - pilotRank.timereq;
      progressToNextRank = Math.min(
        100,
        Math.max(0, ((totalRankTime - remainingTime) / totalRankTime) * 100),
      );
    }

    // Return all PIREPs but stats based only on approved ones
    return NextResponse.json({
      pireps: formattedPireps,
      statistics: {
        totalFlightTime: formatFlightTime(totalSeconds),
        totalPireps: approvedPireps.length,
        rank: pilotRank.name,
        rankId: pilotRank.id,
        nextRank: nextRank ? nextRank.name : null,
        nextRankTimeReq: nextRank ? formatFlightTime(nextRank.timereq) : null,
        progressToNextRank: progressToNextRank.toFixed(2),
      },
    });
  } catch (error) {
    console.error("[PIREPs] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
