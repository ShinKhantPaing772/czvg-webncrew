import { requirePermission } from "@/lib/server-auth";
import { loadIfAircraftSchedules, localAircraftIdFromRequest } from "@/lib/scheduling/infinite-flight/aircraft-schedules";
import { ifJson, ifRouteError } from "@/lib/scheduling/infinite-flight/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "scheduling");
    if (!auth.ok) { auth.response.headers.set("Cache-Control", "no-store"); return auth.response; }
    return ifJson({ success: true, data: await loadIfAircraftSchedules(localAircraftIdFromRequest(request)) });
  } catch (error) { return ifRouteError(error); }
}
