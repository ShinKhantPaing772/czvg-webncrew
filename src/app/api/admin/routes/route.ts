import { NextResponse } from "next/server";
import { models } from "@/lib/models";
import { formatFlightTime } from "@/lib/utils/time";
import { Op } from "sequelize";
import { requirePermission } from "@/lib/server-auth";

// Mark this route as dynamic to prevent static optimization
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Helper function to convert duration format
function convertDurationToSeconds(duration: string | number): number {
  if (typeof duration === "number") return duration;
  if (typeof duration === "string" && duration.includes(":")) {
    const [hours, minutes] = duration.split(":").map(Number);
    return hours * 60 * 60 + minutes * 60;
  }
  return Number(duration);
}

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "routes");
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);

    // Build filter conditions using Sequelize operators
    const where: any = {};
    const aircraftWhere: any = {};

    if (searchParams.get("fltnum")) {
      where.fltnum = { [Op.like]: `%${searchParams.get("fltnum")}%` };
    }
    if (searchParams.get("dep")) {
      where.dep = searchParams.get("dep");
    }
    if (searchParams.get("arr")) {
      where.arr = searchParams.get("arr");
    }
    if (searchParams.get("minDuration")) {
      where.duration = { [Op.gte]: parseInt(searchParams.get("minDuration")!) };
    }
    if (searchParams.get("maxDuration")) {
      where.duration = where.duration
        ? {
            ...where.duration,
            [Op.lte]: parseInt(searchParams.get("maxDuration")!),
          }
        : { [Op.lte]: parseInt(searchParams.get("maxDuration")!) };
    }
    if (searchParams.get("aircraftId")) {
      aircraftWhere.id = searchParams.get("aircraftId");
    }

    // Fetch routes with associations
    const routes = await models.Route.findAll({
      where,
      include: [
        {
          model: models.Aircraft,
          attributes: ["id", "name", "liveryname", "notes"],
          where:
            Object.keys(aircraftWhere).length > 0 ? aircraftWhere : undefined,
          through: { attributes: [] }, // Don't include junction table attributes
        },
      ],
      order: [["fltnum", "ASC"]],
      subQuery: false, // Avoid subquery issues with limit/offset
    });

    // Format the response
    const formattedRoutes = routes.map((route: any) => ({
      id: route.id,
      fltnum: route.fltnum,
      dep: route.dep,
      arr: route.arr,
      duration: formatFlightTime(route.duration),
      notes: route.notes,
      aircraft: route.Aircraft || [],
    }));

    return NextResponse.json({
      success: true,
      data: {
        routes: formattedRoutes,
        total: formattedRoutes.length,
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

// Create a new route
export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "routes");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { fltnum, dep, arr, duration, notes, aircraft } = body;

    // Validate required fields
    if (!fltnum || !dep || !arr || !duration) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 },
      );
    }

    // Convert duration to seconds
    const durationInSeconds = convertDurationToSeconds(duration);

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
      const routeAircraftEntries = aircraft.map((ac) => ({
        routeid: route.id,
        aircraftid: ac.id || ac,
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
      { status: 500 },
    );
  }
}

// Update a route
export async function PUT(request: Request) {
  try {
    const auth = await requirePermission(request, "routes");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { id, fltnum, dep, arr, duration, notes, aircraft } = body;

    // Validate required fields
    if (!id || !fltnum || !dep || !arr || !duration) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 },
      );
    }

    // Find the route
    const route = await models.Route.findByPk(id);
    if (!route) {
      return NextResponse.json(
        { success: false, message: "Route not found" },
        { status: 404 },
      );
    }

    // Convert duration to seconds
    const durationInSeconds = convertDurationToSeconds(duration);

    // Update the route
    await route.update({
      fltnum,
      dep: dep.toUpperCase(),
      arr: arr.toUpperCase(),
      duration: durationInSeconds,
      notes: notes || "",
    });

    // Only update aircraft associations if provided
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
      { status: 500 },
    );
  }
}

// Delete a route
export async function DELETE(request: Request) {
  try {
    const auth = await requirePermission(request, "routes");
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Route ID is required" },
        { status: 400 },
      );
    }

    // Find the route
    const route = await models.Route.findByPk(id);
    if (!route) {
      return NextResponse.json(
        { success: false, message: "Route not found" },
        { status: 404 },
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
      { status: 500 },
    );
  }
}
