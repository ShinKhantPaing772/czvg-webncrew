import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { models } from "@/lib/models";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = cookies();
    const authToken = cookieStore.get("token");

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify token and get pilot
    const response = await fetch("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: authToken.value }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const pilot = await response.json();

    // Parse request body
    const body = await request.json();
    const {
      flightnum,
      departure,
      arrival,
      flightTime,
      date,
      aircraftId,
      fuelUsed,
      multi,
    } = body;

    console.log(body);

    // Validate aircraftId
    if (!aircraftId) {
      console.error("Aircraft ID is required");
      return NextResponse.json(
        { error: "Aircraft ID is required" },
        { status: 400 }
      );
    }

    // Validate and convert flighttime from HH:MM format to minutes
    if (
      !flightTime ||
      typeof flightTime !== "string" ||
      !flightTime.includes(":")
    ) {
      console.error("Invalid flight time format. Expected HH:MM");
      return NextResponse.json(
        { error: "Invalid flight time format. Expected HH:MM" },
        { status: 400 }
      );
    }

    const [hours, minutes] = flightTime.split(":").map(Number);
    const totalSeconds = hours * 3600 + minutes * 60;

    // Create PIREP
    const pirep = await models.Pirep.create({
      flightnum: flightnum,
      departure: departure,
      arrival: arrival,
      flighttime: totalSeconds,
      pilotid: pilot.id,
      date: new Date(date),
      aircraftid: aircraftId,
      fuelused: parseFloat(fuelUsed),
      multi: multi || "None",
      status: 0, // Pending approval
    });
    console.log(pirep);
    return NextResponse.json({ pirep });
  } catch (error) {
    console.error("[PIREP] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit PIREP" },
      { status: 500 }
    );
  }
}
