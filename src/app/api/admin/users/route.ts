import { NextResponse } from "next/server";
import { models } from "@/lib/models";

export async function GET(request: Request) {
  try {
    const users = await models.Pilot.findAll();
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
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
        { status: 400 }
      );
    }

    const pilot = await models.Pilot.findByPk(id);
    if (!pilot) {
      return NextResponse.json(
        { success: false, message: "Pilot not found" },
        { status: 404 }
      );
    }

    await pilot.update({
      status: status,
      notes: notes,
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
