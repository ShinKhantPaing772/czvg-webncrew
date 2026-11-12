import { NextResponse } from "next/server";
import { isCrewLoginDisabled } from "@/lib/login-maintenance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { loginDisabled: isCrewLoginDisabled() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
