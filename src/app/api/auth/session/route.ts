import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

// Mark this route as dynamic to prevent static optimization
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    // Get token from cookies or headers
    let authToken = null;

    // Try to get from cookies first
    const cookieStore = cookies();
    authToken = cookieStore.get("auth_token")?.value || null;

    // If not in cookies, try to get from Authorization header
    if (!authToken) {
      const headersList = headers();
      const authHeader = headersList.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        authToken = authHeader.substring(7);
      }
    }

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the token and get user data from database
    const token = authToken;
    // Import the utility function
    const { getAbsoluteUrl } = await import("@/lib/utils/url");

    const response = await fetch(getAbsoluteUrl("/api/auth/verify"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userData = await response.json();

    // Get pilot data and statistics
    const pilotResponse = await fetch(
      getAbsoluteUrl(`/api/pilots/${userData.id}`)
    );
    if (!pilotResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch pilot data" },
        { status: 500 }
      );
    }
    const pilotData = await pilotResponse.json();

    // Get PIREPs and flight statistics
    const pirepsResponse = await fetch(
      getAbsoluteUrl(`/api/pilots/${userData.id}/pireps`)
    );
    if (!pirepsResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch PIREP data" },
        { status: 500 }
      );
    }
    const { statistics } = await pirepsResponse.json();

    const user = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      rank: statistics.rank,
      flightTime: statistics.totalFlightTime,
      pirepsFiled: statistics.totalPireps,
      joined: pilotData.joined,
    };

    return NextResponse.json({ user: user });
  } catch (error) {
    console.error("[Session] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
