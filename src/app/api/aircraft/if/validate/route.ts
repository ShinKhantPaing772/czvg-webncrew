import { NextRequest, NextResponse } from "next/server";
import {
  getInfiniteFlightAircraft,
  getInfiniteFlightLiveries,
  InfiniteFlightApiError,
  isInfiniteFlightId,
  normalizeInfiniteFlightId,
} from "@/lib/infinite-flight-api";
import { models } from "@/lib/models";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LocalAircraft = {
  id: number;
  name: string;
  ifaircraftid: string | null;
  ifliveryid: string | null;
  liveryname: string | null;
};

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, "aircrafts");
  if (!auth.ok) return auth.response;

  try {
    const [localRows, aircraftResponse, liveryResponse] = await Promise.all([
      models.Aircraft.findAll({
        where: { status: 1 },
        attributes: ["id", "name", "ifaircraftid", "ifliveryid", "liveryname"],
        raw: true,
      }) as Promise<LocalAircraft[]>,
      getInfiniteFlightAircraft(),
      getInfiniteFlightLiveries(),
    ]);

    const officialAircraft = new Map(
      (Array.isArray(aircraftResponse.data.result)
        ? aircraftResponse.data.result
        : []
      )
        .filter(
          (item) =>
            item &&
            isInfiniteFlightId(item.id) &&
            typeof item.name === "string" &&
            item.name.trim(),
        )
        .map((item) => [normalizeInfiniteFlightId(item.id), item] as const),
    );
    const officialLiveries = new Map(
      (Array.isArray(liveryResponse.data.result)
        ? liveryResponse.data.result
        : []
      )
        .filter(
          (item) =>
            item &&
            isInfiniteFlightId(item.id) &&
            typeof item.liveryName === "string" &&
            item.liveryName.trim(),
        )
        .map((item) => [normalizeInfiniteFlightId(item.id), item] as const),
    );

    const mappings = localRows.flatMap((row) => {
      if (!row.ifaircraftid) return [];

      const aircraftId = normalizeInfiniteFlightId(row.ifaircraftid);
      const liveryId = normalizeInfiniteFlightId(row.ifliveryid);
      if (!isInfiniteFlightId(aircraftId)) {
        return [
          {
            id: row.id,
            status: "invalid",
            message: "Stored aircraft ID is not a valid UUID",
          },
        ];
      }

      const aircraft = officialAircraft.get(aircraftId);
      if (!aircraft) {
        return [
          {
            id: row.id,
            status: "invalid",
            message: "Stored aircraft ID was not found in Infinite Flight",
          },
        ];
      }

      if (!isInfiniteFlightId(liveryId)) {
        return [
          {
            id: row.id,
            status: "invalid",
            message: "Stored livery ID is not a valid UUID",
          },
        ];
      }

      const livery = officialLiveries.get(liveryId);
      const liveryAircraftId = normalizeInfiniteFlightId(
        livery?.aircraftID ?? livery?.aircraftId,
      );
      if (!livery || liveryAircraftId !== aircraftId) {
        return [
          {
            id: row.id,
            status: "invalid",
            message:
              "Stored livery was not found or belongs to another aircraft",
          },
        ];
      }

      const namesAreCurrent =
        row.name.trim() === aircraft.name.trim() &&
        String(row.liveryname || "").trim() === livery.liveryName.trim();

      return [
        {
          id: row.id,
          status: namesAreCurrent ? "valid" : "stale",
          message: namesAreCurrent
            ? "Aircraft and livery IDs are verified"
            : "IDs are valid, but the stored names need to be refreshed",
          canonical: {
            aircraftId,
            aircraftName: aircraft.name.trim(),
            liveryId,
            liveryName: livery.liveryName.trim(),
          },
        },
      ];
    });

    const cacheStatus =
      aircraftResponse.cacheStatus === "HIT" &&
      liveryResponse.cacheStatus === "HIT"
        ? "HIT"
        : "MISS";

    return NextResponse.json(
      { mappings },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Infinite-Flight-Cache": cacheStatus,
        },
      },
    );
  } catch (error) {
    console.error("[IF Aircraft Validation] Error:", error);
    const status = error instanceof InfiniteFlightApiError ? error.status : 500;
    const message =
      error instanceof InfiniteFlightApiError
        ? error.message
        : "Failed to validate Infinite Flight aircraft mappings";
    return NextResponse.json({ error: message }, { status });
  }
}
