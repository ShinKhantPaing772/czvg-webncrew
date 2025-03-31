import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { models } from "@/lib/models";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
    };

    // Get user data from database
    const user = await models.Pilot.findByPk(decoded.id, {
      attributes: [
        "id",
        "name",
        "email",
        "callsign",
        "ifc",
        "transhours",
        "transflights",
        "joined",
        "status",
      ],
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    console.error("[Verify] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
