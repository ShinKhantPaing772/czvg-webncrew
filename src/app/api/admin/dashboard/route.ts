import { NextResponse } from "next/server";
import sequelize from "@/lib/database";
import { models } from "@/lib/models";

// Mark this route as dynamic to prevent static optimization
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request) {
  try {
    // Get total pilots count
    const totalPilots = await models.Pilot.count({
      where: {
        status: 1,
      },
    });

    // Get total flights count
    const totalFlights = await models.Pirep.count({
      where: {
        status: 1,
      },
    });

    // Get pending PIREPs count
    const pendingPireps = await models.Pirep.count({
      where: {
        status: 0, // Assuming 0 is pending status
      },
    });

    // Get total flight hours
    const totalHoursQuery = `
      SELECT SUM(flighttime) as total 
      FROM pireps WHERE status = 1 OR 0
    `;
    const [totalHoursResult] = await sequelize.query(totalHoursQuery);
    const totalHoursSeconds =
      (totalHoursResult[0] as { total: number | null })?.total || 0;
    const totalHours = totalHoursSeconds / 3600; // Convert seconds to hours

    // Compile all stats
    const dashboardStats = {
      totalPilots,
      totalFlights,
      pendingPireps,
      totalHours,
    };

    return NextResponse.json({ success: true, data: dashboardStats });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch dashboard statistics" },
      { status: 500 }
    );
  }
}
