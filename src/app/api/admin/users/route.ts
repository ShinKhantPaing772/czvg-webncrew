import { NextResponse } from "next/server";
import { models } from "@/lib/models";
import sequelize from "@/lib/database";

// Mark this route as dynamic to prevent static optimization
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const [users] = await sequelize.query(`
      SELECT p.*, 
        (
          SELECT MAX(\`date\`)
          FROM \`pireps\`
          WHERE \`pilotid\` = p.\`id\` AND \`status\` = 1
        ) AS lastActivity
      FROM \`pilots\` p
    `);

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching admin users", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, status, notes } = body;

    if (!id || status === undefined) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 },
      );
    }

    const pilot = await models.Pilot.findByPk(id);
    if (!pilot) {
      return NextResponse.json(
        { success: false, message: "Pilot not found" },
        { status: 404 },
      );
    }

    await pilot.update({
      status: status,
      notes: notes || "",
    });
    return NextResponse.json({
      success: true,
      message: "Pilot Updated Successfully",
    });
  } catch (error) {
    console.error("Error updating pilot", error);
    return NextResponse.json({
      success: false,
      message: "Pilot Update Failed",
    });
  }
}
