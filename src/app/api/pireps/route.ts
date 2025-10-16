import { NextRequest, NextResponse } from "next/server";
import { models } from "@/lib/models";

export async function POST(request: NextRequest) {
  try {
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

    let parsedDate;
    try {
      // Handle date with timezone preservation to prevent day offset issues
      if (date instanceof Date) {
        parsedDate = new Date(date.getTime());
      } else {
        // Parse the date and adjust for timezone to preserve the selected date
        const dateObj = new Date(date);
        parsedDate = new Date(
          dateObj.getFullYear(),
          dateObj.getMonth(),
          dateObj.getDate(),
          12,
          0,
          0
        );
      }
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
      pilotid,
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
              { name: "Flight Time", value: flightTime, inline: false },
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
