import { requirePermission } from "@/lib/server-auth";
import { loadIfAircraftSchedules, localAircraftIdFromRequest } from "@/lib/scheduling/infinite-flight/aircraft-schedules";
import { ifJson, ifRouteError } from "@/lib/scheduling/infinite-flight/http";
import { editIfAircraftSchedule } from "@/lib/scheduling/infinite-flight/schedule-edit";
import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "scheduling");
    if (!auth.ok) { auth.response.headers.set("Cache-Control", "no-store"); return auth.response; }
    return ifJson({ success: true, data: await loadIfAircraftSchedules(localAircraftIdFromRequest(request), { admin: true }) });
  } catch (error) { return ifRouteError(error); }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requirePermission(request, "scheduling");
    if (!auth.ok) { auth.response.headers.set("Cache-Control", "no-store"); return auth.response; }
    if (new URL(request.url).search) throw new IfLiveError("Supply the local aircraft and schedule edit in the request body", "validation", 400);
    return ifJson({ success: true, data: await editIfAircraftSchedule(auth.user.id, await request.json()) });
  } catch (error) { return ifRouteError(error); }
}
