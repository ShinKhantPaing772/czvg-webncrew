import { NextRequest, NextResponse } from "next/server";
import {
  findInfiniteFlightUser,
  getInfiniteFlightUser,
  InfiniteFlightApiError,
} from "@/lib/infinite-flight-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
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
