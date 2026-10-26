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
import { hasPermission, requireCrewAuth } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasOfficialFlightTime(flight: UnknownRecord) {
  const totalTime = Number(
    flight.totalTime ?? flight.flightTime ?? flight.totalFlightTime,
  );
  return Number.isFinite(totalTime) && totalTime > 0;
}

function hasFinalizedFuel(flight: UnknownRecord) {
  const fuel = Number(
    flight.fuelUsedKg ?? flight.fuelUsed ?? flight.fuelBurnedKg,
  );
  return Number.isFinite(fuel) && fuel > 0;
}

export async function GET(request: NextRequest) {
  const auth = await requireCrewAuth(request);
  if (!auth.ok) return auth.response;

  const pilotId = request.nextUrl.searchParams.get("pilotId");
  const requestedFlightId =
    request.nextUrl.searchParams.get("flightId")?.trim() ?? "";
  const forceRefresh =
    request.nextUrl.searchParams.get("forceRefresh") === "true" ||
    request.nextUrl.searchParams.get("refresh") === "true";

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

    const currentFlight = await findCurrentFlight(ifUserId, forceRefresh);
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
          forceRefresh,
        ),
        getInfiniteFlightUserFlight(ifUserId, flightId, forceRefresh),
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

      if (!getString(userFlight, ["id"]) || !hasFinalizedFuel(userFlight)) {
        try {
          const logbookFlight = await findInfiniteFlightInUserLogbook(
            ifUserId,
            flightId,
            forceRefresh,
          );
          if (logbookFlight) {
            userFlight = { ...userFlight, ...logbookFlight };
          }
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
            forceRefresh,
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
            const logbookFlight = await findInfiniteFlightInUserLogbook(
              ifUserId,
              requestedFlightId,
              forceRefresh,
            );
            if (logbookFlight) {
              requestedFlight = { ...requestedFlight, ...logbookFlight };
            }
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
        recentFlight = await findRecentCompletedInfiniteFlight(
          ifUserId,
          forceRefresh,
        );
      }

      if (!recentFlight && !forceRefresh) {
        recentFlight = await findRecentCompletedInfiniteFlight(ifUserId, true);
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

      flightId = getString(recentFlight, ["id", "flightId"]);

      // If summary logbook entry is missing fuel or official flight time, check exact flight endpoint
      if (
        flightId &&
        (!hasOfficialFlightTime(recentFlight) ||
          !hasFinalizedFuel(recentFlight))
      ) {
        try {
          const { data: detailData } = await getInfiniteFlightUserFlight(
            ifUserId,
            flightId,
            forceRefresh,
          );
          if (detailData?.result && typeof detailData.result === "object") {
            recentFlight = { ...recentFlight, ...detailData.result };
          }
        } catch (error) {
          console.warn(
            "[ACARS] Unable to fetch exact completed-flight details:",
            error,
          );
        }
      }

      source = "recent";
      userFlight = recentFlight;
      flight = recentFlight;
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
    const numFuel = Number(rawFuelUsed);
    const fuelUsed =
      Number.isFinite(numFuel) && numFuel > 0
        ? String(Math.round(numFuel))
        : "";
    const flightTimeEstimated = !hasOfficialFlightTime(userFlight);
    const flightCreatedDate =
      parseInfiniteFlightDate(userFlight.created) ??
      parseInfiniteFlightDate(flight.created);

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
        date: (flightCreatedDate ?? new Date()).toISOString().slice(0, 10),
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
