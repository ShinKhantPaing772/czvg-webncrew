import { NextRequest, NextResponse } from "next/server";
import {
  findInfiniteFlightUser,
  getInfiniteFlightUser,
  InfiniteFlightApiError,
} from "@/lib/infinite-flight-api";
import { incrementCounter } from "@/lib/utils/if-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Signup runs before login, so this route is public, yet every lookup spends
// the VA's Infinite Flight API budget that ACARS and scheduling also need.
const CLIENT_LIMIT = 30; // lookups per client IP per window
const CLIENT_WINDOW_SECONDS = 10 * 60;
const GLOBAL_LIMIT = 15; // lookups per window across all clients
const GLOBAL_WINDOW_SECONDS = 60;

function clientIp(request: NextRequest) {
  // Vercel overwrites x-forwarded-for, so clients can't spoof it there.
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim();
  return ip ? ip.slice(0, 64) : "unknown";
}

async function isLookupRateLimited(request: NextRequest) {
  const clientHits = await incrementCounter(
    `rate:ifc-lookup:ip:${clientIp(request)}`,
    CLIENT_WINDOW_SECONDS,
  );
  // Checked first, so a client over its own limit can't use up the shared
  // budget and lock everyone else out.
  if (clientHits > CLIENT_LIMIT) return true;

  const globalHits = await incrementCounter(
    "rate:ifc-lookup:all",
    GLOBAL_WINDOW_SECONDS,
  );
  return globalHits > GLOBAL_LIMIT;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    if (await isLookupRateLimited(req)) {
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
