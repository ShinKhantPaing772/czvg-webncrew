import { NextResponse } from "next/server";
import sequelize from "@/lib/database";
import { formatFlightTime } from "@/lib/utils/time";
import { QueryTypes } from "sequelize";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
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
              'notes', a.notes,
              'rankreq', a.rankreq,
              'awardreq', a.awardreq,
              'status', a.status
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
        { status: 404 }
      );
    }

    // Get recent flights on this route
    const recentFlightsQuery = `
      SELECT 
        p.id, 
        p.date, 
        p.flighttime,
        p.status,
        a.name as aircraft_name,
        a.ifaircraftid,
        pilot.name as pilot_name,
        pilot.callsign as pilot_callsign
      FROM pireps p
      JOIN aircraft a ON p.aircraftid = a.id
      JOIN pilots pilot ON p.pilotid = pilot.id
      WHERE p.departure = :dep AND p.arrival = :arr
      ORDER BY p.date DESC
      LIMIT 10
    `;

    const recentFlights = await sequelize.query(recentFlightsQuery, {
      replacements: { dep: (route as any).dep, arr: (route as any).arr },
      type: QueryTypes.SELECT,
    });

    // Format the route data
    const formattedRoute = {
      id: (route as any).id,
      fltnum: (route as any).fltnum,
      dep: (route as any).dep,
      arr: (route as any).arr,
      duration: formatFlightTime(parseInt((route as any).duration)),
      durationSeconds: Number((route as any).duration) || 0,
      notes: (route as any).notes,
      aircraft: JSON.parse((route as any).aircraft || "[]"),
      recentFlights: recentFlights.map((flight: any) => ({
        id: flight.id,
        date: flight.date,
        pilot: flight.pilot_name,
        pilotCallsign: flight.pilot_callsign,
        aircraft: flight.aircraft_name,
        aircraftCode: flight.ifaircraftid,
        flightTime: formatFlightTime(flight.flighttime),
        status: flight.status,
      })),
    };

    return NextResponse.json({ success: true, data: formattedRoute });
  } catch (error) {
    console.error("Error fetching route details:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch route details" },
      { status: 500 }
    );
  }
}
