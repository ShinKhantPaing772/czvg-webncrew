import { NextResponse } from "next/server";
import Token from "@/lib/models/token";

export async function POST(request: Request) {
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

  try {
    // Delete token from database
    await Token.destroy({ where: { token } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Logout] Error:", error);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
