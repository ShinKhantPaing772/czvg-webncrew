import { NextRequest, NextResponse } from "next/server";
import { models } from "@/lib/models";
import { cookies, headers } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    // Check authentication - Get token from cookies or headers
    let authToken = null;

    const cookieStore = cookies();
    authToken = cookieStore.get("auth_token")?.value || null;

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

    const { getAbsoluteUrl } = await import("@/lib/utils/url");

    const response = await fetch(getAbsoluteUrl("/api/auth/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    if (!aircraftId) {
      return NextResponse.json(
        { error: "Aircraft ID is required" },
        { status: 400 }
      );
    }

    let parsedDate;
    try {
      parsedDate = date instanceof Date ? date : new Date(date);
      if (isNaN(parsedDate.getTime())) throw new Error("Invalid date");
    } catch {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    if (
      !flightTime ||
      typeof flightTime !== "string" ||
      !flightTime.includes(":")
    ) {
      return NextResponse.json(
        { error: "Invalid flight time format. Expected HH:MM" },
        { status: 400 }
      );
    }

    let parsedFuel;
    try {
      parsedFuel = parseFloat(fuelUsed);
      if (isNaN(parsedFuel)) throw new Error("Invalid fuel amount");
    } catch {
      return NextResponse.json(
        { error: "Invalid fuel amount" },
        { status: 400 }
      );
    }

    const [hours, minutes] = flightTime.split(":").map(Number);
    const totalSeconds = hours * 3600 + minutes * 60;

    // Create PIREP
    const pirep = await models.Pirep.create({
      flightnum,
      departure,
      arrival,
      flighttime: totalSeconds,
      pilotid: pilot.id,
      date: parsedDate,
      aircraftid: aircraftId,
      fuelused: parsedFuel,
      multi: multi || "None",
      status: 0,
    });

    // --- Send Discord Webhook ---
    const webhookUrl = process.env.DISCORD_WEBHOOK;
    if (webhookUrl) {
      const discordPayload = {
        embeds: [
          {
            title: "New PIREP submitted!",
            color: 3447003, // blue
            fields: [
              { name: "Flight Number", value: flightnum, inline: false },
              {
                name: "Pilot",
                value: `${pilot.name} (${pilot.callsign})`,
                inline: false,
              },
              {
                name: "Route",
                value: `${departure} - ${arrival}`,
                inline: false,
              },
              {
                name: "Operator",
                value: "China Southern Airlines Virtual Group",
                inline: false,
              },
              { name: "Flight Time", value: flightTime, inline: false },
            ],
            footer: {
              text: `China Southern Virtual Group • ${parsedDate.toLocaleDateString()} ${parsedDate.toLocaleTimeString(
                [],
                { hour: "2-digit", minute: "2-digit" }
              )}`,
            },
          },
        ],
      };

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });
    }

    return NextResponse.json({ pirep });
  } catch (error) {
    console.error("[PIREP] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit PIREP" },
      { status: 500 }
    );
  }
}
