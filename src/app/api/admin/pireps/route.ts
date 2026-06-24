import { NextResponse } from "next/server";
import { models } from "@/lib/models";
import { formatFlightTime } from "@/lib/utils/time";
import { requirePermission } from "@/lib/server-auth";

// Mark this route as dynamic to prevent static optimization
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "pireps");
    if (!auth.ok) return auth.response;

    // Simplified query - no filters, just get all PIREPs
    const { count, rows: pireps } = await models.Pirep.findAndCountAll({
      include: [
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
          include: [
            {
              model: models.Pilot,
              as: "User",
              attributes: ["id", "callsign", "name"],
            },
          ],
        },
      ],
      order: [["id", "DESC"]],
    });

    // Get counts by status for tabs
    const pendingCount = await models.Pirep.count({ where: { status: 0 } });
    const approvedCount = await models.Pirep.count({ where: { status: 1 } });
    const rejectedCount = await models.Pirep.count({ where: { status: 2 } });

    // Set default pagination values
    const page = 1;
    const limit = 10;
    const totalPages = Math.ceil(count / limit);

    return NextResponse.json({
      success: true,
      data: {
        pireps: pireps.map((pirep) => ({
          ...pirep.toJSON(),
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

// Update PIREP status
export async function PUT(request: Request) {
  try {
    const auth = await requirePermission(request, "pireps");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { id, status, comment } = body;

    if (!id || status === undefined) {
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

    await pirep.update({ status });

    if (comment?.trim()) {
      await models.PirepComment.create({
        pirepid: id,
        userid: auth.user.id,
        content: comment.trim(),
      });
    }

    return NextResponse.json({
      success: true,
      data: pirep,
    });
  } catch (error) {
    console.error("Error updating PIREP:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update PIREP" },
      { status: 500 },
    );
  }
}
