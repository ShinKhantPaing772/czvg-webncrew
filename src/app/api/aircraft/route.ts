import { NextResponse } from "next/server";
import { models } from "@/lib/models";

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
      ],
      order: [["name", "ASC"]],
      raw: true,
    });
    return NextResponse.json({ aircrafts });
  } catch (error) {
    console.error("[Aircraft] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
