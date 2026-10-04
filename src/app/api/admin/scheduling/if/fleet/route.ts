import { requirePermission } from "@/lib/server-auth";
import { getIfAccessToken } from "@/lib/scheduling/infinite-flight/connection";
import { getIfFleet, getIfOrganizations, getIfPosition, getIfSchedules } from "@/lib/scheduling/infinite-flight/client";
import { IfLiveError, isIfUuid } from "@/lib/scheduling/infinite-flight/config";
import { ifJson, ifRouteError } from "@/lib/scheduling/infinite-flight/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const auth = await requirePermission(request, "scheduling"); if (!auth.ok) { auth.response.headers.set("Cache-Control", "no-store"); return auth.response; }
  try {
    const params = new URL(request.url).searchParams; const organizationId = params.get("organizationId"); const aircraftId = params.get("aircraftId");
    if ((organizationId && !isIfUuid(organizationId)) || (aircraftId && (!organizationId || !isIfUuid(aircraftId)))) throw new IfLiveError("Select a valid IF organization and aircraft", "validation", 400);
    const token = await getIfAccessToken();
    if (!organizationId) return ifJson({ success: true, data: { organizations: await getIfOrganizations(token) } });
    const aircraft = await getIfFleet(token, organizationId);
    if (!aircraftId) return ifJson({ success: true, data: { aircraft } });
    if (!aircraft.some(row => row.id.toLowerCase() === aircraftId.toLowerCase())) throw new IfLiveError("The selected IF aircraft is not in this organization", "not_found", 404);
    let positionError: string | undefined;
    const [position, schedules] = await Promise.all([
      getIfPosition(token, aircraftId).catch(error => {
        if (!(error instanceof IfLiveError) || error.code !== "position_unavailable") throw error;
        positionError = "IF has no persisted position for this aircraft.";
        return null;
      }),
      getIfSchedules(token, aircraftId),
    ]);
    return ifJson({ success: true, data: { position, schedules, ...(positionError ? { positionError } : {}) } });
  } catch (error) { return ifRouteError(error); }
}
