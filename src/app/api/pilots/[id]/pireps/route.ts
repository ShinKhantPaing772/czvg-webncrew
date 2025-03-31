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

    console.log(formattedPireps);
    return NextResponse.json({
      pireps: formattedPireps,
      statistics: {
        totalFlightTime: formatFlightTime(totalSeconds),
        totalPireps: pireps.length,
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
