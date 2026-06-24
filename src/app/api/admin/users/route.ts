import { NextResponse } from "next/server";
import { models } from "@/lib/models";
import sequelize from "@/lib/database";
import { requirePermission } from "@/lib/server-auth";

// Mark this route as dynamic to prevent static optimization
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "users");
    if (!auth.ok) return auth.response;

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
    const auth = await requirePermission(request, "users");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { id, name, email, callsign, status, notes } = body;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const callsignPattern = /^China Southern \d{3}VG$/;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing pilot id" },
        { status: 400 },
      );
    }

    const updateFields: Record<string, string | number> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json(
          { success: false, message: "Name is required" },
          { status: 400 },
        );
      }
      updateFields.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim()) {
        return NextResponse.json(
          { success: false, message: "Email is required" },
          { status: 400 },
        );
      }
      const nextEmail = email.trim();
      if (!emailPattern.test(nextEmail)) {
        return NextResponse.json(
          { success: false, message: "Enter a valid email address" },
          { status: 400 },
        );
      }
      updateFields.email = nextEmail;
    }

    if (callsign !== undefined) {
      if (typeof callsign !== "string" || !callsign.trim()) {
        return NextResponse.json(
          { success: false, message: "Assigned callsign is required" },
          { status: 400 },
        );
      }
      const nextCallsign = callsign.trim();
      if (!callsignPattern.test(nextCallsign)) {
        return NextResponse.json(
          {
            success: false,
            message: "Callsign must match China Southern ###VG",
          },
          { status: 400 },
        );
      }
      const existingPilot = await models.Pilot.findOne({
        where: { callsign: nextCallsign },
      });
      if (existingPilot && String(existingPilot.get("id")) !== String(id)) {
        return NextResponse.json(
          {
            success: false,
            message: "Callsign is already assigned to another user",
          },
          { status: 409 },
        );
      }
      updateFields.callsign = nextCallsign;
    }

    if (status !== undefined) {
      const nextStatus = Number(status);
      if (!Number.isInteger(nextStatus) || nextStatus < 0 || nextStatus > 3) {
        return NextResponse.json(
          { success: false, message: "Invalid status" },
          { status: 400 },
        );
      }
      updateFields.status = nextStatus;
    }

    if (notes !== undefined) {
      updateFields.notes = typeof notes === "string" ? notes : "";
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { success: false, message: "No fields to update" },
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

    await pilot.update(updateFields);
    return NextResponse.json({
      success: true,
      message: "Pilot Updated Successfully",
      user: pilot,
    });
  } catch (error) {
    console.error("Error updating pilot", error);
    return NextResponse.json({
      success: false,
      message: "Pilot Update Failed",
    });
  }
}
