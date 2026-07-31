import { NextRequest, NextResponse } from "next/server";
import {
  findCurrentFlight,
  findInfiniteFlightInUserLogbook,
  findLocalAircraft,
  findRecentCompletedInfiniteFlight,
  isRecentInfiniteFlight,
  resolveInfiniteFlightUserId,
} from "@/lib/acars/current-flight";
import {
  extractAirportFromFlightPlan,
  extractAirportFromRecord,
  extractFlightTime,
  getNestedString,
  getString,
  parseInfiniteFlightDate,
  type UnknownRecord,
} from "@/lib/acars/infinite-flight-data";
import {
  getInfiniteFlightFlightPlan,
  getInfiniteFlightUserFlight,
  InfiniteFlightApiError,
  isInfiniteFlightId,
} from "@/lib/infinite-flight-api";
import { models } from "@/lib/models";
import { hasPermission, requireAuth } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasOfficialFlightTime(flight: UnknownRecord) {
  return (
    typeof flight.totalTime === "number" &&
    Number.isFinite(flight.totalTime) &&
    flight.totalTime > 0
  );
}

function hasFinalizedFuel(flight: UnknownRecord) {
  return (
    typeof flight.fuelUsedKg === "number" &&
    Number.isFinite(flight.fuelUsedKg) &&
    flight.fuelUsedKg >= 0
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const pilotId = request.nextUrl.searchParams.get("pilotId");
  const requestedFlightId =
    request.nextUrl.searchParams.get("flightId")?.trim() ?? "";

  if (!pilotId) {
    return NextResponse.json(
      { error: "Pilot ID is required" },
      { status: 400 },
    );
  }
  if (requestedFlightId && !isInfiniteFlightId(requestedFlightId)) {
    return NextResponse.json(
      { error: "Flight ID must be a valid Infinite Flight UUID" },
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
    let source: "active" | "recent" = "active";
    let sessionId = "";
    let flightId = "";
    let flight: UnknownRecord = {};
    let flightPlan: UnknownRecord = {};
    let userFlight: UnknownRecord = {};

    if (currentFlight) {
      sessionId = currentFlight.sessionId;
      flight = currentFlight.flight;
      flightId = getString(flight, ["flightId", "id"]);

      const [flightPlanResult, userFlightResult] = await Promise.allSettled([
        getInfiniteFlightFlightPlan(
          sessionId,
          flightId,
        ),
        getInfiniteFlightUserFlight(ifUserId, flightId),
      ]);

      if (flightPlanResult.status === "fulfilled") {
        flightPlan = flightPlanResult.value.data;
      } else {
        console.warn(
          "[ACARS] Unable to fetch flight plan:",
          flightPlanResult.reason,
        );
      }

      if (userFlightResult.status === "fulfilled") {
        userFlight = userFlightResult.value.data.result;
      } else {
        console.warn(
          "[ACARS] Unable to fetch user flight:",
          userFlightResult.reason,
        );
      }

      if (!getString(userFlight, ["id"])) {
        try {
          userFlight =
            (await findInfiniteFlightInUserLogbook(ifUserId, flightId)) ?? {};
        } catch (error) {
          console.warn(
            "[ACARS] Unable to cross-check the current user flight:",
            error,
          );
        }
      }
    } else {
      let recentFlight: UnknownRecord | null = null;

      if (requestedFlightId) {
        let requestedFlight: UnknownRecord = {};

        try {
          const { data } = await getInfiniteFlightUserFlight(
            ifUserId,
            requestedFlightId,
          );
          requestedFlight = data.result;
        } catch (error) {
          console.warn(
            "[ACARS] Exact completed-flight lookup is not ready:",
            error,
          );
        }

        if (
          !hasOfficialFlightTime(requestedFlight) ||
          !hasFinalizedFuel(requestedFlight)
        ) {
          try {
            requestedFlight =
              (await findInfiniteFlightInUserLogbook(
                ifUserId,
                requestedFlightId,
              )) ?? requestedFlight;
          } catch (error) {
            console.warn(
              "[ACARS] Completed-flight logbook lookup is not ready:",
              error,
            );
          }
        }

        const requestedFlightUserId = getString(requestedFlight, ["userId"]);
        if (
          getString(requestedFlight, ["id", "flightId"]).toLowerCase() ===
            requestedFlightId.toLowerCase() &&
          (!requestedFlightUserId ||
            requestedFlightUserId.toLowerCase() === ifUserId.toLowerCase()) &&
          isRecentInfiniteFlight(requestedFlight)
        ) {
          recentFlight = requestedFlight;
        }
      } else {
        recentFlight = await findRecentCompletedInfiniteFlight(ifUserId);
      }

      if (!recentFlight) {
        return NextResponse.json(
          {
            error:
              "No active or recently completed Infinite Flight flight found for this pilot",
          },
          { status: 404 },
        );
      }

      source = "recent";
      userFlight = recentFlight;
      flight = recentFlight;
      flightId = getString(recentFlight, ["id", "flightId"]);
    }

    const aircraftId =
      getNestedString(flight, [
        "aircraftId",
        "aircraftID",
        "aircraft.id",
        "aircraft.aircraftId",
        "aircraft.aircraftID",
      ]) ||
      getNestedString(userFlight, [
        "aircraftId",
        "aircraftID",
        "aircraft.id",
        "aircraft.aircraftId",
        "aircraft.aircraftID",
      ]);
    const liveryId =
      getNestedString(flight, [
        "liveryId",
        "liveryID",
        "livery.id",
        "livery.liveryId",
        "livery.liveryID",
      ]) ||
      getNestedString(userFlight, [
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
      ]) ||
      extractAirportFromRecord(userFlight, ["originAirport"]) ||
      extractAirportFromFlightPlan(flightPlan, 0);
    const arrival =
      extractAirportFromRecord(flight, [
        "arrival",
        "arrivalAirport",
        "destination",
        "destinationAirport",
      ]) ||
      extractAirportFromRecord(userFlight, ["destinationAirport"]) ||
      extractAirportFromFlightPlan(flightPlan, -1);
    const rawFuelUsed =
      getString(userFlight, ["fuelUsedKg"]) ||
      getString(flight, [
        "fuelUsed",
        "fuelUsedKg",
        "fuelBurned",
        "fuelBurnedKg",
      ]);
    const fuelUsed =
      Number.isFinite(Number(rawFuelUsed)) && Number(rawFuelUsed) > 0
        ? rawFuelUsed
        : "";
    const flightTimeEstimated = !hasOfficialFlightTime(userFlight);
    const createdDate = parseInfiniteFlightDate(userFlight.created);

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
        flightTime:
          extractFlightTime(userFlight) || extractFlightTime(flight),
        date: (createdDate ?? new Date()).toISOString().slice(0, 10),
        aircraftId: aircraft ? String(aircraft.id) : "",
        fuelUsed,
        multi: "",
      },
      meta: {
        source,
        sessionId: sessionId || null,
        flightId,
        aircraftMatched: Boolean(aircraft),
        userFlightMatched: Boolean(getString(userFlight, ["id"])),
        flightTimeEstimated,
        fuelPending: !fuelUsed,
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
