import { NextRequest, NextResponse } from "next/server";
import { models } from "@/lib/models";
import { cookies, headers } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    // Check authentication - Get token from cookies or headers
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

    // Verify token and get pilot
    // Import the utility function
    const { getAbsoluteUrl } = await import("@/lib/utils/url");

    const response = await fetch(getAbsoluteUrl("/api/auth/verify"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: authToken }),
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

    // Validate aircraftId
    if (!aircraftId) {
      console.error("Aircraft ID is required");
      return NextResponse.json(
        { error: "Aircraft ID is required" },
        { status: 400 }
      );
    }

    // Validate date
    let parsedDate;
    try {
      parsedDate = date instanceof Date ? date : new Date(date);
      if (isNaN(parsedDate.getTime())) {
        throw new Error("Invalid date");
      }
    } catch (error) {
      console.error("Invalid date format", error);
      return NextResponse.json(
        { error: "Invalid date format" },
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

    // Validate fuelUsed
    let parsedFuel;
    try {
      parsedFuel = parseFloat(fuelUsed);
      if (isNaN(parsedFuel)) {
        throw new Error("Invalid fuel amount");
      }
    } catch (error) {
      console.error("Invalid fuel amount", error);
      return NextResponse.json(
        { error: "Invalid fuel amount" },
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
      date: parsedDate,
      aircraftid: aircraftId,
      fuelused: parsedFuel,
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
