import { NextResponse } from "next/server";
import { models } from "@/lib/models";
import { formatFlightTime } from "@/lib/utils/time";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const pilotId = params.id;

    // Fetch all PIREPs for the pilot
    const pireps = await models.Pirep.findAll({
      where: { pilotId },
      include: [
        {
          model: models.Aircraft,
          as: "Aircraft",
          attributes: ["id", "name", "liveryname"],
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

    // Format flight time for each PIREP
    const formattedPireps = pireps.map((pirep) => ({
      ...pirep.get(),
      flighttime: formatFlightTime(pirep.flighttime || 0),
    }));

    // Calculate total flight time in seconds
    const totalSeconds = pireps.reduce(
      (total, pirep) => total + (pirep.flighttime || 0),
      0
    );

    // Fetch all ranks from the database
    const ranks = await models.Rank.findAll({
      order: [["timereq", "ASC"]],
    });

    // Determine the pilot's rank based on total flight time
    let pilotRank = { id: 0, name: "Trainee", timereq: 0 }; // Default rank if no ranks found

    for (const rank of ranks) {
      if (totalSeconds >= rank.timereq) {
        pilotRank = rank.get();
      } else {
        break; // Stop once we find a rank with higher requirements than the pilot's time
      }
    }

    // Calculate progress to next rank
    let nextRank = null;
    let progressToNextRank = 100; // Default to 100% if there's no next rank

    const currentRankIndex = ranks.findIndex(
      (rank) => rank.id === pilotRank.id
    );
    if (currentRankIndex < ranks.length - 1) {
      nextRank = ranks[currentRankIndex + 1].get();
      const remainingTime = nextRank.timereq - totalSeconds;
      const totalRankTime = nextRank.timereq - pilotRank.timereq;
      progressToNextRank = Math.min(
        100,
        Math.max(0, ((totalRankTime - remainingTime) / totalRankTime) * 100)
      );
    }

    return NextResponse.json({
      pireps: formattedPireps,
      statistics: {
        totalFlightTime: formatFlightTime(totalSeconds),
        totalPireps: pireps.length,
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
      { status: 500 }
    );
  }
}
