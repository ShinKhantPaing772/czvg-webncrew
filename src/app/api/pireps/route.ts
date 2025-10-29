import { NextRequest, NextResponse } from "next/server";
import { models } from "@/lib/models";

export async function POST(request: NextRequest) {
  try {
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
      pilotid,
      pilotname,
      pilotcallsign,
    } = body;

    if (!pilotid) {
      return NextResponse.json(
        { error: "Pilot ID is required" },
        { status: 400 }
      );
    }

    if (!aircraftId) {
      return NextResponse.json(
        { error: "Aircraft ID is required" },
        { status: 400 }
      );
    }

    // --- Validate flight time ---
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

    // --- Parse fuel used ---
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

    // --- Fetch multiplier only if a code is provided ---
    let multiplier = null;
    if (multi && typeof multi === "string" && multi.trim() !== "") {
      multiplier = await models.Multiplier.findOne({
        where: { code: multi },
      });
    }

    const [hours, minutes] = flightTime.split(":").map(Number);
    const totalSeconds = hours * 3600 + minutes * 60;

    // Apply multiplier if available
    const adjustedSeconds = multiplier
      ? totalSeconds * multiplier.multiplier
      : totalSeconds;

    // Convert adjusted seconds back to HH:MM format for display
    const adjustedHours = Math.floor(adjustedSeconds / 3600);
    const adjustedMinutes = Math.floor((adjustedSeconds % 3600) / 60);
    const adjustedFlightTime = `${adjustedHours
      .toString()
      .padStart(2, "0")}:${adjustedMinutes.toString().padStart(2, "0")}`;

    // --- Create PIREP ---
    const pirep = await models.Pirep.create({
      flightnum,
      departure,
      arrival,
      flighttime: multiplier
        ? totalSeconds * multiplier.multiplier
        : totalSeconds,
      pilotid,
      date: date || new Date(),
      aircraftid: aircraftId,
      fuelused: parsedFuel,
      multi: multiplier ? multiplier.name : "None",
      status: 0,
    });

    // --- Discord Webhook ---
    const webhookUrl = process.env.DISCORD_WEBHOOK;
    if (webhookUrl) {
      const discordPayload = {
        embeds: [
          {
            title: "New PIREP submitted!",
            color: 3447003,
            fields: [
              { name: "Flight Number", value: flightnum, inline: false },
              {
                name: "Pilot",
                value: `${pilotname} (${pilotcallsign})`,
                inline: false,
              },
              {
                name: "Route",
                value: `${departure} - ${arrival}`,
                inline: false,
              },
              {
                name: "Fuel Used",
                value: `${parsedFuel} KG`,
                inline: false,
              },
              { name: "Flight Time", value: adjustedFlightTime, inline: false },
            ],
            footer: {
              text: `China Southern Virtual Group • ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString(
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
