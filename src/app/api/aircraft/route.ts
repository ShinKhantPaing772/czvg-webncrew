import { NextResponse } from "next/server";
import { models } from "@/lib/models";
import { requirePermission } from "@/lib/server-auth";

// Mark this route as dynamic to prevent static optimization
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    // Fetch all aircraft from database
    const aircrafts = await models.Aircraft.findAll({
      where: {
        status: 1,
      },
      attributes: [
        "id",
        "name",
        "ifaircraftid",
        "liveryname",
        "ifliveryid",
        "status",
        "notes",
        "rankreq",
        "awardreq",
      ],
      order: [["name", "ASC"]],
      raw: true,
    });
    return NextResponse.json({ aircrafts });
  } catch (error) {
    console.error("[Aircraft] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "aircrafts");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const {
      notes,
      rankReq,
      awardReq,
      ifAircraftId,
      ifAircraftName,
      ifLiveryId,
      ifLiveryName,
    } = body;

    // Validate required fields
    if (!ifAircraftId || !ifAircraftName || !ifLiveryId || !ifLiveryName) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 },
      );
    }

    const aircraft = await models.Aircraft.create({
      name: ifAircraftName,
      ifaircraftid: ifAircraftId,
      ifliveryid: ifLiveryId,
      liveryname: ifLiveryName,
      notes: notes || null,
      rankreq: rankReq || 3,
      awardreq: awardReq || null,
      status: 1,
    });

    return NextResponse.json({ success: true, data: aircraft });
  } catch (error) {
    console.error("Error posting route:", error);
    return NextResponse.json(
      { success: false, message: "Failed to post route" },
      { status: 500 },
    );
  }
}
