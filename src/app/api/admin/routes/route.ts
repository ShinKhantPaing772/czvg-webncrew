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
    const aircraftId = searchParams.get("aircraftId");

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
      WHERE 1=1
      ${fltnum ? `AND r.fltnum LIKE '%${fltnum}%'` : ""}
      ${dep ? `AND r.dep = '${dep}'` : ""}
      ${arr ? `AND r.arr = '${arr}'` : ""}
      ${aircraftId ? `AND a.id = '${aircraftId}'` : ""}
      GROUP BY r.id
      ORDER BY r.fltnum ASC
    `;

    // Execute the query
    const [routesResult] = await sequelize.query(query);

    // Format the routes data
    const formattedRoutes = Array.isArray(routesResult)
      ? routesResult.map((route: any) => ({
          id: route.id,
          fltnum: route.fltnum,
          dep: route.dep,
          arr: route.arr,
          duration: formatFlightTime(parseInt(route.duration)),
          notes: route.notes,
          aircraft: JSON.parse(route.aircraft || "[]"),
        }))
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
      const routeAircraftEntries = aircraft.map((aircraftId) => ({
        routeid: route.id,
        aircraftid: aircraftId,
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
