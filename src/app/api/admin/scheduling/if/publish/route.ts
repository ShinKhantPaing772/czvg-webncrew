import { requirePermission } from "@/lib/server-auth";
import { LiveAircraft, LiveFlight } from "@/lib/scheduling/models";
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
    if (new URL(request.url).search) throw new IfLiveError("Supply the publishing scope in the request body", "validation", 400);
    const input = await request.text();
    const body = input.trim() ? JSON.parse(input) : {};
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["aircraftId", "flightId"].includes(key)) ||
        (body.aircraftId !== undefined && body.flightId !== undefined)) {
      throw new IfLiveError("Select either a local aircraft or one approved local flight to publish", "validation", 400);
    }
    const aircraftId = body.aircraftId;
    const flightId = body.flightId;
    let linkedAircraftId = aircraftId;
    if (flightId !== undefined) {
      if (!Number.isSafeInteger(flightId) || flightId <= 0 || flightId > 2_147_483_647) throw new IfLiveError("Select a valid approved local flight", "validation", 400);
      const flight = await LiveFlight.findByPk(flightId);
      if (!flight) throw new IfLiveError("Local flight not found", "not_found", 404);
      if (flight.status !== "approved") throw new IfLiveError("Only an approved flight can be published individually", "validation", 409);
      linkedAircraftId = flight.live_aircraft_id;
    }
    if (linkedAircraftId !== undefined) {
      if (!Number.isSafeInteger(linkedAircraftId) || linkedAircraftId <= 0 || linkedAircraftId > 2_147_483_647) throw new IfLiveError("Select a valid local aircraft", "validation", 400);
      const aircraft = await LiveAircraft.findByPk(linkedAircraftId);
      if (!aircraft) throw new IfLiveError("Local aircraft not found", "not_found", 404);
      if (!aircraft.if_aircraft_id) throw new IfLiveError("Link this local aircraft to IF before publishing", "binding", 409);
    }
    return ifJson({ success: true, data: await runIfLivePublisher(flightId !== undefined ? { flightId } : aircraftId === undefined ? {} : { aircraftId }) });
  } catch (error) { return ifRouteError(error); }
}
