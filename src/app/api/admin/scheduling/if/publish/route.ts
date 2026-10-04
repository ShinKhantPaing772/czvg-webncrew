import { requirePermission } from "@/lib/server-auth";
import { LiveAircraft } from "@/lib/scheduling/models";
import { runIfLivePublisher } from "@/lib/scheduling/infinite-flight/publisher";
import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";
import { ifJson, ifRouteError } from "@/lib/scheduling/infinite-flight/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "scheduling");
    if (!auth.ok) { auth.response.headers.set("Cache-Control", "no-store"); return auth.response; }
    const input = await request.text();
    const body = input.trim() ? JSON.parse(input) : {};
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => key !== "aircraftId")) {
      throw new IfLiveError("Use an optional local aircraft ID to publish queued flights", "validation", 400);
    }
    const aircraftId = body.aircraftId;
    if (aircraftId !== undefined) {
      if (!Number.isSafeInteger(aircraftId) || aircraftId <= 0) throw new IfLiveError("Select a valid local aircraft", "validation", 400);
      const aircraft = await LiveAircraft.findByPk(aircraftId);
      if (!aircraft) throw new IfLiveError("Local aircraft not found", "not_found", 404);
      if (!aircraft.if_aircraft_id) throw new IfLiveError("Link this local aircraft to IF before publishing", "binding", 409);
    }
    return ifJson({ success: true, data: await runIfLivePublisher(aircraftId === undefined ? {} : { aircraftId }) });
  } catch (error) { return ifRouteError(error); }
}
