import { NextRequest, NextResponse } from "next/server";
import { models } from "@/lib/models";
import { requireAuth } from "@/lib/server-auth";

function normalizeIcao(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function parseFlightTime(value: unknown) {
  if (typeof value !== "string") return null;

  const match = value.trim().match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || hours < 0) return null;

  return hours * 3600 + minutes * 60;
}

function parseFlightDate(value: unknown) {
  if (!value) return new Date();

  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  const oneDayAhead = now + 24 * 60 * 60 * 1000;

  if (parsed.getTime() < oneYearAgo || parsed.getTime() > oneDayAhead) {
    return null;
  }

  return parsed;
}

async function canUseMultiplier(pilotId: number, minrankid?: number | null) {
  if (!minrankid) return true;

  const rank = await models.Rank.findByPk(minrankid);
  if (!rank) return false;

  const approvedFlightSeconds =
    (await models.Pirep.sum("flighttime", {
      where: { pilotid: pilotId, status: 1 },
    })) || 0;

  return approvedFlightSeconds >= rank.timereq;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

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

    if (String(auth.user.id) !== String(pilotid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const normalizedDeparture = normalizeIcao(departure);
    const normalizedArrival = normalizeIcao(arrival);

    if (!/^[A-Z0-9]{4}$/.test(normalizedDeparture)) {
      return NextResponse.json(
        { error: "Departure ICAO must be 4 characters" },
        { status: 400 }
      );
    }

    if (!/^[A-Z0-9]{4}$/.test(normalizedArrival)) {
      return NextResponse.json(
        { error: "Arrival ICAO must be 4 characters" },
        { status: 400 }
      );
    }

    const parsedAircraftId = Number(aircraftId);
    if (!Number.isInteger(parsedAircraftId) || parsedAircraftId <= 0) {
      return NextResponse.json(
        { error: "Aircraft ID is required" },
        { status: 400 }
      );
    }

    const aircraft = await models.Aircraft.findOne({
      where: { id: parsedAircraftId, status: 1 },
    });
    if (!aircraft) {
      return NextResponse.json(
        { error: "Selected aircraft is not available" },
        { status: 400 }
      );
    }

    const totalSeconds = parseFlightTime(flightTime);
    if (totalSeconds === null || totalSeconds <= 0) {
      return NextResponse.json(
        { error: "Invalid flight time format. Expected HH:MM" },
        { status: 400 }
      );
    }

    const parsedDate = parseFlightDate(date);
    if (!parsedDate) {
      return NextResponse.json(
        { error: "Invalid flight date" },
        { status: 400 }
      );
    }

    // --- Parse fuel used ---
    let parsedFuel;
    try {
      parsedFuel = parseFloat(fuelUsed);
      if (!Number.isFinite(parsedFuel) || parsedFuel < 0) {
        throw new Error("Invalid fuel amount");
      }
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
        where: { code: multi.trim() },
      });

      if (!multiplier) {
        return NextResponse.json(
          { error: "Invalid multiplier code" },
          { status: 400 }
        );
      }

      if (!(await canUseMultiplier(auth.user.id, multiplier.minrankid))) {
        return NextResponse.json(
          { error: "You do not meet the rank requirement for this multiplier" },
          { status: 403 }
        );
      }
    }

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
      flightnum: String(flightnum || "").trim(),
      departure: normalizedDeparture,
      arrival: normalizedArrival,
      flighttime: multiplier
        ? totalSeconds * multiplier.multiplier
        : totalSeconds,
      pilotid: auth.user.id,
      date: parsedDate,
      aircraftid: parsedAircraftId,
      fuelused: Math.round(parsedFuel),
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
              {
                name: "Flight Number",
                value: String(flightnum || "").trim(),
                inline: false,
              },
              {
                name: "Pilot",
                value: `${pilotname} (${pilotcallsign})`,
                inline: false,
              },
              {
                name: "Route",
                value: `${normalizedDeparture} - ${normalizedArrival}`,
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
