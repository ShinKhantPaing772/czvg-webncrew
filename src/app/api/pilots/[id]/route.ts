import { NextResponse } from "next/server";
import { models } from "@/lib/models";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const pilotId = params.id;

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
