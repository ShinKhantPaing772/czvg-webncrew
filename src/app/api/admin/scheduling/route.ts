import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/server-auth";
import { changeAircraft, changeFlight, schedulingSnapshot, schedulingFailure } from "@/lib/scheduling/service";
import { runIfLivePublisher } from "@/lib/scheduling/infinite-flight/publisher";
import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "scheduling");
    if (!auth.ok) return auth.response;
    return NextResponse.json(await schedulingSnapshot({ id: auth.user.id, admin: true }));
  } catch (error) { const failure = schedulingFailure(error); return NextResponse.json({ error: failure.error }, { status: failure.status }); }
}
async function mutate(request: Request, creating: boolean) {
  try {
    const auth = await requirePermission(request, "scheduling");
    if (!auth.ok) return auth.response;
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    if (creating && body.action !== "add_aircraft") return NextResponse.json({ error: "Unknown fleet action" }, { status: 400 });
    const actor = { id: auth.user.id, admin: true };
    const result = await (creating || body.action === "edit_aircraft" ? changeAircraft : changeFlight)(actor, body);
    if (!creating && body.action === "approve" && !("if_aircraft_linked" in result && result.if_aircraft_linked)) {
      return NextResponse.json({ success: true, ...result, publication: { state: "not_linked", message: "This aircraft is not linked to IF; no publishing attempt was needed." } }, { status: 200 });
    }
    if (!creating && body.action === "approve") {
      try {
        const publication = await runIfLivePublisher({ flightId: Number(body.flight_id) });
        return NextResponse.json({ success: true, ...result, publication }, { status: 200 });
      } catch (error) {
        const message = error instanceof IfLiveError
          ? error.message
          : "The flight was approved, but IF publishing could not be confirmed. Refresh its status and retry.";
        if (!(error instanceof IfLiveError)) console.error("[Scheduling] Immediate IF publish attempt failed", error instanceof Error ? error.name : "Unknown error");
        return NextResponse.json({ success: true, ...result, publication: { state: "unavailable", message } }, { status: 200 });
      }
    }
    return NextResponse.json({ success: true, ...result }, { status: creating ? 201 : 200 });
  } catch (error) { const failure = schedulingFailure(error); return NextResponse.json({ error: failure.error }, { status: failure.status }); }
}
export const POST = (request: Request) => mutate(request, true);
export const PATCH = (request: Request) => mutate(request, false);
