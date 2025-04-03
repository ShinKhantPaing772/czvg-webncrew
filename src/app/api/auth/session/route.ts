import { stat } from "fs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const cookieStore = cookies();
    const authToken = cookieStore.get("token");

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the token and get user data from database
    const token = authToken.value;
    const response = await fetch("http://localhost:3000/api/auth/verify", {
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
      `http://localhost:3000/api/pilots/${userData.id}`
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
      `http://localhost:3000/api/pilots/${userData.id}/pireps`
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
