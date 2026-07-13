import { NextResponse } from "next/server";
import { Op } from "sequelize";
import type { Includeable } from "sequelize";
import { models } from "@/lib/models";
import { formatFlightTime } from "@/lib/utils/time";
import { requirePermission } from "@/lib/server-auth";

// Mark this route as dynamic to prevent static optimization
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pirepInclude: Includeable[] = [
  {
    model: models.Pilot,
    as: "Pilot",
    attributes: ["id", "callsign", "name", "ifc"],
  },
  {
    model: models.Aircraft,
    as: "Aircraft",
    attributes: ["id", "name", "liveryname"],
  },
  {
    model: models.PirepComment,
    as: "Comments",
    attributes: ["id", "userid", "content", "dateposted"],
    separate: true,
    order: [["id", "ASC"] as [string, string]],
    include: [
      {
        model: models.Pilot,
        as: "User",
        attributes: ["id", "callsign", "name"],
      },
    ],
  },
];

function parseFlightTimeToSeconds(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  const colonMatch = trimmedValue.match(/^(\d+):([0-5]\d)$/);
  if (colonMatch) {
    return Number(colonMatch[1]) * 3600 + Number(colonMatch[2]) * 60;
  }

  return null;
}

async function serializePirep(id: number) {
  const pirep = await models.Pirep.findByPk(id, {
    include: pirepInclude,
  });

  if (!pirep) return null;

  return {
    ...pirep.toJSON(),
    flighttimeSeconds: pirep.flighttime,
    flighttime: formatFlightTime(pirep.flighttime),
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "pireps");
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const pageParam = Number(searchParams.get("page") ?? "1");
    const limitParam = Number(searchParams.get("limit") ?? "10");
    const statusParam = searchParams.get("status");
    const searchQuery = searchParams.get("search")?.trim();
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit =
      Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 100
        ? limitParam
        : 10;
    const offset = (page - 1) * limit;
    const where: Record<string | symbol, unknown> = {};

    if (statusParam && ["0", "1", "2"].includes(statusParam)) {
      where.status = Number(statusParam);
    }

    if (searchQuery) {
      where[Op.or] = [
        { flightnum: { [Op.like]: `%${searchQuery}%` } },
        { departure: { [Op.like]: `%${searchQuery}%` } },
        { arrival: { [Op.like]: `%${searchQuery}%` } },
        { "$Pilot.name$": { [Op.like]: `%${searchQuery}%` } },
        { "$Pilot.callsign$": { [Op.like]: `%${searchQuery}%` } },
      ];
    }

    const { count, rows: pireps } = await models.Pirep.findAndCountAll({
      where,
      include: pirepInclude,
      order: [["id", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    // Get counts by status for tabs
    const pendingCount = await models.Pirep.count({ where: { status: 0 } });
    const approvedCount = await models.Pirep.count({ where: { status: 1 } });
    const rejectedCount = await models.Pirep.count({ where: { status: 2 } });

    const totalPages = Math.ceil(count / limit);

    return NextResponse.json({
      success: true,
      data: {
        pireps: pireps.map((pirep) => ({
          ...pirep.toJSON(),
          flighttimeSeconds: pirep.flighttime,
          flighttime: formatFlightTime(pirep.flighttime),
        })),
        pagination: {
          total: count,
          totalPages,
          currentPage: page,
          limit,
        },
        counts: {
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
          total: count,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching PIREPs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch PIREPs" },
      { status: 500 },
    );
  }
}

// Update PIREP fields, status, and admin comments
export async function PUT(request: Request) {
  try {
    const auth = await requirePermission(request, "pireps");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const {
      id,
      status,
      comment,
      flightnum,
      departure,
      arrival,
      flighttime,
      aircraftid,
      fuelused,
      multi,
      deleteCommentIds,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const pirep = await models.Pirep.findByPk(id);

    if (!pirep) {
      return NextResponse.json(
        { success: false, error: "PIREP not found" },
        { status: 404 },
      );
    }

    const updates: Record<string, string | number> = {};

    if (flightnum !== undefined) {
      const trimmedFlightnum = String(flightnum).trim();
      if (!trimmedFlightnum) {
        return NextResponse.json(
          { success: false, error: "Flight number is required" },
          { status: 400 },
        );
      }
      updates.flightnum = trimmedFlightnum;
    }

    if (departure !== undefined) {
      const trimmedDeparture = String(departure).trim().toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(trimmedDeparture)) {
        return NextResponse.json(
          { success: false, error: "Departure ICAO must be 4 characters" },
          { status: 400 },
        );
      }
      updates.departure = trimmedDeparture;
    }

    if (arrival !== undefined) {
      const trimmedArrival = String(arrival).trim().toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(trimmedArrival)) {
        return NextResponse.json(
          { success: false, error: "Arrival ICAO must be 4 characters" },
          { status: 400 },
        );
      }
      updates.arrival = trimmedArrival;
    }

    if (flighttime !== undefined) {
      const parsedFlighttime = parseFlightTimeToSeconds(flighttime);
      if (parsedFlighttime === null || parsedFlighttime < 0) {
        return NextResponse.json(
          { success: false, error: "Duration must be in HH:MM format" },
          { status: 400 },
        );
      }
      updates.flighttime = parsedFlighttime;
    }

    if (aircraftid !== undefined) {
      const parsedAircraftId = Number(aircraftid);
      if (!Number.isInteger(parsedAircraftId) || parsedAircraftId <= 0) {
        return NextResponse.json(
          { success: false, error: "Aircraft type is required" },
          { status: 400 },
        );
      }

      const aircraft = await models.Aircraft.findByPk(parsedAircraftId);
      if (!aircraft) {
        return NextResponse.json(
          { success: false, error: "Selected aircraft was not found" },
          { status: 400 },
        );
      }

      updates.aircraftid = parsedAircraftId;
    }

    if (fuelused !== undefined) {
      const parsedFuelUsed = Number(fuelused);
      if (!Number.isFinite(parsedFuelUsed) || parsedFuelUsed < 0) {
        return NextResponse.json(
          { success: false, error: "Fuel used must be a valid number" },
          { status: 400 },
        );
      }
      updates.fuelused = Math.round(parsedFuelUsed);
    }

    if (multi !== undefined) {
      const trimmedMultiplier = String(multi).trim();
      if (!trimmedMultiplier) {
        return NextResponse.json(
          { success: false, error: "Multiplier is required" },
          { status: 400 },
        );
      }
      updates.multi = trimmedMultiplier;
    }

    if (status !== undefined) {
      const parsedStatus = Number(status);
      if (![0, 1, 2].includes(parsedStatus)) {
        return NextResponse.json(
          { success: false, error: "Invalid PIREP status" },
          { status: 400 },
        );
      }
      updates.status = parsedStatus;
    }

    if (Object.keys(updates).length > 0) {
      await pirep.update(updates);
    }

    if (Array.isArray(deleteCommentIds) && deleteCommentIds.length > 0) {
      await models.PirepComment.destroy({
        where: {
          pirepid: id,
          id: deleteCommentIds
            .map((commentId) => Number(commentId))
            .filter((commentId) => Number.isInteger(commentId)),
        },
      });
    }

    if (comment?.trim()) {
      await models.PirepComment.create({
        pirepid: id,
        userid: auth.user.id,
        content: comment.trim(),
      });
    }

    const updatedPirep = await serializePirep(Number(id));

    return NextResponse.json({
      success: true,
      data: updatedPirep,
    });
  } catch (error) {
    console.error("Error updating PIREP:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update PIREP" },
      { status: 500 },
    );
  }
}
