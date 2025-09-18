import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { models } from "@/lib/models";

export async function POST(request: Request) {
  try {
    let token: string | null = null;

    // Try to get token from request body
    try {
      const body = await request.json();
      token = body.token;
    } catch {
      // If body parsing fails, continue to check headers
    }

    // If token not in body, try to get from Authorization header
    if (!token) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Find token in database
    const tokenRecord = await models.Token.findOne({
      where: { token },
    });

    // Check if token exists
    if (!tokenRecord) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check if token is expired
    if (new Date() > tokenRecord.expiresAt) {
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }

    // Check if token is revoked
    if (tokenRecord.isRevoked) {
      return NextResponse.json({ error: "Token revoked" }, { status: 401 });
    }

    const user = await models.Pilot.findByPk(tokenRecord.pilotId, {
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
      include: [
        {
          model: models.Permission,
          attributes: ["userid", "name"], // whatever fields you want
        },
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
