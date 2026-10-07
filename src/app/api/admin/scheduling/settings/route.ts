import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/server-auth";
import { changeSchedulingSettings, getSchedulingSettings } from "@/lib/scheduling/settings";
import { schedulingFailure } from "@/lib/scheduling/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "scheduling");
    if (!auth.ok) return auth.response;
    return NextResponse.json({ success: true, data: await getSchedulingSettings() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = schedulingFailure(error);
    return NextResponse.json({ success: false, error: failure.error }, { status: failure.status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requirePermission(request, "scheduling");
    if (!auth.ok) return auth.response;
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 }); }
    const data = await changeSchedulingSettings(auth.user.id, body);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = schedulingFailure(error);
    return NextResponse.json({ success: false, error: failure.error }, { status: failure.status, headers: { "Cache-Control": "no-store" } });
  }
}
