import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/utils/if-cache";

const CACHE_TTL_SECONDS = 60 * 60; // 60 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const cacheKey = `if-aircraft-liveries-${id}`;
  const cachedData = await getCached<Record<string, unknown>>(cacheKey);
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
      `https://api.infiniteflight.com/public/v2/aircraft/${id}/liveries`,
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
        { error: "Livery fetch failed" },
        { status: response.status },
      );
    }

    const data = await response.json();
    await setCached(cacheKey, data, CACHE_TTL_SECONDS);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("[IF Liveries] Fetch error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
