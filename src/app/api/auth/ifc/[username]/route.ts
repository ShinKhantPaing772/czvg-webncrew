import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/utils/if-cache";

const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: { username: string } },
) {
  const { username } = params;

  if (!username) {
    return NextResponse.json(
      { error: "Username is required" },
      { status: 400 },
    );
  }

  const cacheKey = `if-user-${username}`;
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
      "https://api.infiniteflight.com/public/v2/users",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.IF_API}`,
        },
        body: JSON.stringify({
          discourseNames: [username],
        }),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "IFC check failed" },
        { status: response.status },
      );
    }

    const data = await response.json();
    await setCached(cacheKey, data, CACHE_TTL_SECONDS);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("[IFC User] Fetch error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
