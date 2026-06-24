import { NextResponse } from "next/server";
import { models } from "@/lib/models";
import { hasPermission, requireAuth } from "@/lib/server-auth";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const pilotId = params.id;
    const canViewPilot =
      String(auth.user.id) === String(pilotId) ||
      hasPermission(auth.user, ["users", "pireps"]);

    if (!canViewPilot) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch pilot data including basic info and flight statistics
    const pilot = await models.Pilot.findOne({
      where: { id: pilotId },
      attributes: [
        "id",
        "name",
        "email",
        "callsign",
        "transhours",
        "transflights",
        "joined",
        "status",
      ],
    });

    if (!pilot) {
      return NextResponse.json({ error: "Pilot not found" }, { status: 404 });
    }

    return NextResponse.json(pilot);
  } catch (error) {
    console.error("[Pilot] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
