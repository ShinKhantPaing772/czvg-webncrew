import { NextRequest, NextResponse } from "next/server";
import {
  findInfiniteFlightUser,
  getInfiniteFlightUser,
  InfiniteFlightApiError,
} from "@/lib/infinite-flight-api";
import { isIfcLookupRateLimited } from "@/lib/infinite-flight/lookup-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    if (await isIfcLookupRateLimited(req)) {
      return NextResponse.json(
        {
          error:
            "Too many IFC username checks. Please wait a few minutes and try again.",
        },
        { status: 429, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const { username } = await params;
    const { data, cacheStatus } = await getInfiniteFlightUser(username);
    const user = findInfiniteFlightUser(data.result, username);
    return NextResponse.json(
      { ...data, result: user ? [user] : [] },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Infinite-Flight-Cache": cacheStatus,
        },
      },
    );
  } catch (error) {
    console.error("[IFC User] Fetch error:", error);
    const status = error instanceof InfiniteFlightApiError ? error.status : 500;
    const message =
      error instanceof InfiniteFlightApiError
        ? error.message
        : "Failed to check the IFC username";
    return NextResponse.json({ error: message }, { status });
  }
}
