import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    console.log("[Logout] Processing logout request");

    // Create a response object
    const response = NextResponse.json(
      { message: "Logout successful" },
      { status: 200 }
    );

    // Clear the token cookie by setting maxAge to 0
    response.cookies.set("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0, // This immediately expires the cookie
    });

    console.log("[Logout] Token cookie cleared successfully");
    return response;
  } catch (error) {
    console.error("[Logout] Error:", error);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
