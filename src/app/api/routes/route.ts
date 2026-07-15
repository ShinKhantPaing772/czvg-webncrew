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
    const pageParam = Number(searchParams.get("page") ?? "1");
    const limitParam = Number(searchParams.get("limit") ?? "100");
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit =
      Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 500
        ? limitParam
        : 100;
    const offset = (page - 1) * limit;

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

    const fromAndWhere = `
      FROM routes r
      LEFT JOIN route_aircraft ra ON r.id = ra.routeid
      LEFT JOIN aircraft a ON ra.aircraftid = a.id AND a.status = 1
      WHERE ${whereClauses.join(" AND ")}
    `;

    const countRows = await sequelize.query<{ total: number }>(
      `
        SELECT COUNT(DISTINCT r.id) AS total
        ${fromAndWhere}
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );
    const total = Number(countRows[0]?.total ?? 0);

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
              'notes', a.notes,
              'rankreq', a.rankreq,
              'awardreq', a.awardreq,
              'status', a.status
            )
          ), 
          '[]'
        ) AS aircrafts
      ${fromAndWhere}
    `;

    // Add group by and order by
    query += " GROUP BY r.id ORDER BY r.fltnum LIMIT :limit OFFSET :offset";
    // Execute the raw query
    const routes = await sequelize.query(query, {
      replacements: {
        ...replacements,
        limit,
        offset,
      },
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
            durationSeconds: Number(route.duration) || 0,
            notes: route.notes,
            aircraft: aircraftArray
              .filter(
                (ac: any) => ac.aircraft_id && ac.aircraft_name,
              )
              .map((ac: any) => ({
                id: ac.aircraft_id,
                name: ac.aircraft_name,
                liveryname: ac.livery_name,
                notes: ac.notes || null,
                rankreq: ac.rankreq || null,
                awardreq: ac.awardreq || null,
                status: ac.status ?? null,
              })),
          };
        })
      : [];

    return NextResponse.json({
      success: true,
      data: formattedRoutes,
      pagination: {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching routes:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch routes" },
      { status: 500 },
    );
  }
}
