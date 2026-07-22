import { NextRequest, NextResponse } from "next/server";
import {
  getInfiniteFlightAircraftLiveries,
  InfiniteFlightApiError,
} from "@/lib/infinite-flight-api";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requirePermission(req, "aircrafts");
  if (!auth.ok) return auth.response;

  try {
    const { data, cacheStatus } = await getInfiniteFlightAircraftLiveries(
      params.id,
    );
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Infinite-Flight-Cache": cacheStatus,
      },
    });
  } catch (error) {
    console.error("[IF Liveries] Fetch error:", error);
    const status = error instanceof InfiniteFlightApiError ? error.status : 500;
    const message =
      error instanceof InfiniteFlightApiError
        ? error.message
        : "Failed to load Infinite Flight liveries";
    return NextResponse.json({ error: message }, { status });
  }
}
