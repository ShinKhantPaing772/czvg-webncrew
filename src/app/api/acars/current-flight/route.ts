import { NextRequest, NextResponse } from "next/server";
import {
  findCurrentFlight,
  findLocalAircraft,
  resolveInfiniteFlightUserId,
} from "@/lib/acars/current-flight";
import {
  extractAirportFromFlightPlan,
  extractAirportFromRecord,
  extractFlightTime,
  getNestedString,
  getString,
  type UnknownRecord,
} from "@/lib/acars/infinite-flight-data";
import {
  getInfiniteFlightFlightPlan,
  InfiniteFlightApiError,
} from "@/lib/infinite-flight-api";
import { models } from "@/lib/models";
import { hasPermission, requireAuth } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const pilotId = request.nextUrl.searchParams.get("pilotId");

  if (!pilotId) {
    return NextResponse.json(
      { error: "Pilot ID is required" },
      { status: 400 },
    );
  }

  const canFetchPilot =
    String(auth.user.id) === String(pilotId) ||
    hasPermission(auth.user, ["pireps", "users"]);

  if (!canFetchPilot) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const pilot = await models.Pilot.findByPk(pilotId, {
      attributes: ["id", "ifc", "ifuserid"],
      raw: true,
    });

    if (!pilot) {
      return NextResponse.json({ error: "Pilot not found" }, { status: 404 });
    }

    const pilotRecord = pilot as unknown as UnknownRecord;
    const ifUserId = await resolveInfiniteFlightUserId(pilotRecord);
    if (!ifUserId) {
      return NextResponse.json(
        { error: "Infinite Flight user ID is not linked to this pilot" },
        { status: 400 },
      );
    }

    const currentFlight = await findCurrentFlight(ifUserId);
    if (!currentFlight) {
      return NextResponse.json(
        { error: "No active Infinite Flight flight found for this pilot" },
        { status: 404 },
      );
    }

    const { sessionId, flight } = currentFlight;
    const flightId = getString(flight, ["flightId", "id"]);
    let flightPlan: UnknownRecord = {};

    if (flightId) {
      try {
        const { data } = await getInfiniteFlightFlightPlan(
          sessionId,
          flightId,
        );
        flightPlan = data;
      } catch (error) {
        console.warn("[ACARS] Unable to fetch flight plan:", error);
      }
    }

    const aircraftId = getNestedString(flight, [
      "aircraftId",
      "aircraftID",
      "aircraft.id",
      "aircraft.aircraftId",
      "aircraft.aircraftID",
    ]);
    const liveryId = getNestedString(flight, [
      "liveryId",
      "liveryID",
      "livery.id",
      "livery.liveryId",
      "livery.liveryID",
    ]);
    const aircraft = await findLocalAircraft(aircraftId, liveryId);

    const departure =
      extractAirportFromRecord(flight, [
        "departure",
        "departureAirport",
        "origin",
        "originAirport",
      ]) || extractAirportFromFlightPlan(flightPlan, 0);
    const arrival =
      extractAirportFromRecord(flight, [
        "arrival",
        "arrivalAirport",
        "destination",
        "destinationAirport",
      ]) || extractAirportFromFlightPlan(flightPlan, -1);
    const fuelUsed = getString(flight, [
      "fuelUsed",
      "fuelUsedKg",
      "fuelBurned",
      "fuelBurnedKg",
    ]);

    return NextResponse.json({
      acars: {
        flightnum: getString(flight, [
          "flightNumber",
          "flightnum",
          "flightNum",
          "flightNo",
          "flight",
        ]),
        departure,
        arrival,
        flightTime: extractFlightTime(flight),
        date: new Date().toISOString().slice(0, 10),
        aircraftId: aircraft ? String(aircraft.id) : "",
        fuelUsed,
        multi: "",
      },
      meta: {
        sessionId,
        flightId,
        aircraftMatched: Boolean(aircraft),
      },
    });
  } catch (error) {
    console.error("[ACARS] Error:", error);
    const status = error instanceof InfiniteFlightApiError ? error.status : 500;
    const message =
      error instanceof InfiniteFlightApiError
        ? error.message
        : "Failed to fetch ACARS data from Infinite Flight";
    return NextResponse.json({ error: message }, { status });
  }
}
