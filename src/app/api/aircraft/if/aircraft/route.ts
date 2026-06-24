import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/utils/if-cache";
import { requirePermission } from "@/lib/server-auth";

const CACHE_KEY = "if-aircraft-list";
const CACHE_TTL_SECONDS = 60 * 60; // 60 minutes

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "aircrafts");
  if (!auth.ok) return auth.response;

  const cachedData = await getCached<Record<string, unknown>>(CACHE_KEY);
  if (cachedData) {
    return NextResponse.json(cachedData, { status: 200 });
  }

  if (!process.env.IF_API) {
    return NextResponse.json(
      { error: "Infinite Flight API key is not configured" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      "https://api.infiniteflight.com/public/v2/aircraft",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.IF_API}`,
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Aircraft fetch failed" },
        { status: response.status },
      );
    }

    const data = await response.json();
    await setCached(CACHE_KEY, data, CACHE_TTL_SECONDS);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("[IF Aircraft] Fetch error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
