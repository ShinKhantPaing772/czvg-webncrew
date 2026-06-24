import { NextResponse } from "next/server";
import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { Op, QueryTypes } from "sequelize";
import { requirePermission } from "@/lib/server-auth";

// Mark this route as dynamic to prevent static optimization
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "home");
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, message: "Start date and end date are required" },
        { status: 400 }
      );
    }

    // Get pilots count who joined between dates
    const pilotsInRange = await models.Pilot.count({
      where: {
        joined: {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        },
      },
    });

    // Get PIREPs count filed between dates
    const pirepsInRange = await models.Pirep.count({
      where: {
        date: {
          [Op.between]: [startDate, endDate],
        },
        status: 1,
      },
    });

    // Get flight hours for PIREPs in date range
    const flightHoursQuery = `
      SELECT SUM(flighttime) as total 
      FROM pireps 
      WHERE date BETWEEN :startDate AND :endDate AND status = 1
    `;
    const flightHoursResult = await sequelize.query<{ total: number | null }>(
      flightHoursQuery,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
      },
    );
    const flightHoursSeconds =
      flightHoursResult[0]?.total || 0;
    const flightHours = flightHoursSeconds / 3600; // Convert seconds to hours

    // Compile date range stats
    const dateRangeStats = {
      pilotsInRange,
      pirepsInRange,
      flightHours,
    };

    return NextResponse.json({ success: true, data: dateRangeStats });
  } catch (error) {
    console.error("Error fetching date range stats:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch date range statistics" },
      { status: 500 }
    );
  }
}
