import { NextResponse } from "next/server";
import sequelize from "@/lib/database";
import { formatFlightTime } from "@/lib/utils/time";
import { QueryTypes } from "sequelize";
import { requirePermission } from "@/lib/server-auth";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requirePermission(request, "routes");
    if (!auth.ok) return auth.response;

    const routeId = params.id;

    // Build the SQL query to get route details with aircraft
    const routeQuery = `
      SELECT 
        r.id, 
        r.fltnum, 
        r.dep, 
        r.arr, 
        r.duration, 
        r.notes,
        COALESCE(
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'id', a.id,
              'name', a.name, 
              'ifaircraftid', a.ifaircraftid,
              'liveryname', a.liveryname,
              'ifliveryid', a.ifliveryid,
              'notes', a.notes

            )
          ), 
          '[]'
        ) AS aircraft
      FROM routes r
      LEFT JOIN route_aircraft ra ON r.id = ra.routeid
      LEFT JOIN aircraft a ON ra.aircraftid = a.id
      WHERE r.id = :routeId
      GROUP BY r.id
    `;

    // Execute the query
    const routeResult = await sequelize.query(routeQuery, {
      replacements: { routeId },
      type: QueryTypes.SELECT,
    });
    const route = routeResult.length > 0 ? routeResult[0] : null;

    if (!route) {
      return NextResponse.json(
        { success: false, message: "Route not found" },
        { status: 404 },
      );
    }

    // Format the route data
    const formattedRoute = {
      id: (route as any).id,
      fltnum: (route as any).fltnum,
      dep: (route as any).dep,
      arr: (route as any).arr,
      duration: formatFlightTime(parseInt((route as any).duration)),
      rawDuration: parseInt((route as any).duration),
      notes: (route as any).notes,
      aircraft: JSON.parse((route as any).aircraft || "[]"),
    };

    return NextResponse.json({ success: true, data: formattedRoute });
  } catch (error) {
    console.error("Error fetching route details:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch route details" },
      { status: 500 },
    );
  }
}
