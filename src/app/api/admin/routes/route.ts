import { NextResponse } from "next/server";
import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { formatFlightTime } from "@/lib/utils/time";

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
      WHERE 1=1
      ${fltnum ? `AND r.fltnum LIKE '%${fltnum}%'` : ""}
      ${dep ? `AND r.dep = '${dep}'` : ""}
      ${arr ? `AND r.arr = '${arr}'` : ""}
      ${minDuration ? `AND r.duration >= ${minDuration}` : ""}
      ${maxDuration ? `AND r.duration <= ${maxDuration}` : ""}
      ${aircraftId ? `AND a.id = '${aircraftId}'` : ""}
      ${
        !aircraftId && aircraft ? `AND a.name LIKE '%${aircraft}%'` : ""
      } /* For backward compatibility */
    `;

    // Add group by and order by
    query += " GROUP BY r.id ORDER BY r.fltnum";

    // Execute the query
    const [routes] = await sequelize.query(query);
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
                  ac.aircraft_id && ac.aircraft_name && ac.livery_name
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

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT r.id) as total
      FROM routes r
      LEFT JOIN route_aircraft ra ON r.id = ra.routeid
      LEFT JOIN aircraft a ON ra.aircraftid = a.id
      WHERE 1=1
      ${fltnum ? `AND r.fltnum LIKE '%${fltnum}%'` : ""}
      ${dep ? `AND r.dep = '${dep}'` : ""}
      ${arr ? `AND r.arr = '${arr}'` : ""}
      ${aircraftId ? `AND a.id = '${aircraftId}'` : ""}
    `;

    const [countResult] = await sequelize.query(countQuery);
    const total = (countResult[0] as { total: number }).total;

    return NextResponse.json({
      success: true,
      data: {
        routes: formattedRoutes,
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching routes:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch routes" },
      { status: 500 }
    );
  }
}

// Create a new route
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fltnum, dep, arr, duration, notes, aircraft } = body;

    // Validate required fields
    if (!fltnum || !dep || !arr || !duration) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Convert duration from HH:MM format to seconds if needed
    let durationInSeconds = duration;
    if (typeof duration === "string" && duration.includes(":")) {
      const [hours, minutes] = duration.split(":").map(Number);
      durationInSeconds = hours * 60 * 60 + minutes * 60;
    }

    // Create the route
    const route = await models.Route.create({
      fltnum,
      dep: dep.toUpperCase(),
      arr: arr.toUpperCase(),
      duration: durationInSeconds,
      notes: notes || "",
    });

    // Add aircraft associations if provided
    if (Array.isArray(aircraft) && aircraft.length > 0) {
      const routeAircraftEntries = aircraft.map((aircraft) => ({
        routeid: route.id,
        aircraftid: aircraft.id,
      }));

      await models.RouteAircraft.bulkCreate(routeAircraftEntries);
    }

    return NextResponse.json({
      success: true,
      data: route,
      message: "Route created successfully",
    });
  } catch (error) {
    console.error("Error creating route:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create route" },
      { status: 500 }
    );
  }
}

// Update a route
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, fltnum, dep, arr, duration, notes, aircraft } = body;

    // Validate required fields
    if (!id || !fltnum || !dep || !arr || !duration) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find the route
    const route = await models.Route.findByPk(id);
    if (!route) {
      return NextResponse.json(
        { success: false, message: "Route not found" },
        { status: 404 }
      );
    }

    // Convert duration from HH:MM format to seconds if needed
    let durationInSeconds = duration;
    if (typeof duration === "string" && duration.includes(":")) {
      const [hours, minutes] = duration.split(":").map(Number);
      durationInSeconds = hours * 60 * 60 + minutes * 60;
    }

    // Update the route
    await route.update({
      fltnum,
      dep: dep.toUpperCase(),
      arr: arr.toUpperCase(),
      duration: durationInSeconds,
      notes: notes || "",
    });

    // Update aircraft associations if provided
    if (Array.isArray(aircraft)) {
      // Remove existing associations
      await models.RouteAircraft.destroy({
        where: { routeid: id },
      });

      // Add new associations
      if (aircraft.length > 0) {
        const routeAircraftEntries = aircraft.map((aircraftId) => ({
          routeid: id,
          aircraftid: aircraftId,
        }));

        await models.RouteAircraft.bulkCreate(routeAircraftEntries);
      }
    }

    return NextResponse.json({
      success: true,
      data: route,
      message: "Route updated successfully",
    });
  } catch (error) {
    console.error("Error updating route:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update route" },
      { status: 500 }
    );
  }
}

// Delete a route
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Route ID is required" },
        { status: 400 }
      );
    }

    // Find the route
    const route = await models.Route.findByPk(id);
    if (!route) {
      return NextResponse.json(
        { success: false, message: "Route not found" },
        { status: 404 }
      );
    }

    // Delete route aircraft associations first
    await models.RouteAircraft.destroy({
      where: { routeid: id },
    });

    // Delete the route
    await route.destroy();

    return NextResponse.json({
      success: true,
      message: "Route deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting route:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete route" },
      { status: 500 }
    );
  }
}
