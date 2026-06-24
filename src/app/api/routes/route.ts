import { NextResponse } from "next/server";
import sequelize from "@/lib/database";
import { formatFlightTime } from "@/lib/utils/time";
import { QueryTypes } from "sequelize";

// Mark this route as dynamic to prevent static optimization
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const fltnum = searchParams.get("fltnum");
    const dep = searchParams.get("dep");
    const arr = searchParams.get("arr");
    const aircraft = searchParams.get("aircraft"); // For backward compatibility
    const aircraftId = searchParams.get("aircraftId");
    const minDuration = searchParams.get("minDuration");
    const maxDuration = searchParams.get("maxDuration");

    const whereClauses = ["1=1"];
    const replacements: Record<string, string | number> = {};

    if (fltnum) {
      whereClauses.push("r.fltnum LIKE :fltnum");
      replacements.fltnum = `%${fltnum}%`;
    }
    if (dep) {
      whereClauses.push("r.dep = :dep");
      replacements.dep = dep;
    }
    if (arr) {
      whereClauses.push("r.arr = :arr");
      replacements.arr = arr;
    }
    if (minDuration) {
      const value = Number(minDuration);
      if (!Number.isNaN(value)) {
        whereClauses.push("r.duration >= :minDuration");
        replacements.minDuration = value;
      }
    }
    if (maxDuration) {
      const value = Number(maxDuration);
      if (!Number.isNaN(value)) {
        whereClauses.push("r.duration <= :maxDuration");
        replacements.maxDuration = value;
      }
    }
    if (aircraftId) {
      whereClauses.push("a.id = :aircraftId");
      replacements.aircraftId = aircraftId;
    } else if (aircraft) {
      whereClauses.push("a.name LIKE :aircraft");
      replacements.aircraft = `%${aircraft}%`;
    }

    // Build the SQL query with filters
    let query = `
      SELECT 
        r.id AS id, 
        r.fltnum, 
        r.dep, 
        r.arr, 
        r.duration, 
        r.notes,
        COALESCE(
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'aircraft_id', a.id,
              'aircraft_name', a.name, 
              'livery_name', a.liveryname,
              'notes', a.notes
            )
          ), 
          '[]'
        ) AS aircrafts
      FROM routes r
      LEFT JOIN route_aircraft ra ON r.id = ra.routeid
      LEFT JOIN aircraft a ON ra.aircraftid = a.id
      WHERE ${whereClauses.join(" AND ")}
    `;

    // Add group by and order by
    query += " GROUP BY r.id ORDER BY r.fltnum";
    // Execute the raw query
    const routes = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    });

    // Format the routes data
    let formattedRoutes = Array.isArray(routes)
      ? routes.map((route: any) => {
          // Parse the JSON string to an array of aircraft objects
          const aircraftArray = JSON.parse(route.aircrafts || "[]");

          return {
            id: route.id,
            fltnum: route.fltnum,
            dep: route.dep,
            arr: route.arr,
            duration: formatFlightTime(parseInt(route.duration)),
            notes: route.notes,
            aircraft: aircraftArray
              .filter(
                (ac: any) =>
                  ac.aircraft_id && ac.aircraft_name && ac.livery_name,
              )
              .map((ac: any) => ({
                id: ac.aircraft_id,
                name: ac.aircraft_name,
                liveryname: ac.livery_name,
                notes: ac.notes || null,
              })),
          };
        })
      : [];

    return NextResponse.json({ success: true, data: formattedRoutes });
  } catch (error) {
    console.error("Error fetching routes:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch routes" },
      { status: 500 },
    );
  }
}
