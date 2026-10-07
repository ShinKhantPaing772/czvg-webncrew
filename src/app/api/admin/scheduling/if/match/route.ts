import { requirePermission } from "@/lib/server-auth";
import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";
import { ifJson, ifRouteError } from "@/lib/scheduling/infinite-flight/http";
import { matchIfAircraftSchedule } from "@/lib/scheduling/infinite-flight/schedule-match";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "scheduling");
    if (!auth.ok) { auth.response.headers.set("Cache-Control", "no-store"); return auth.response; }
    if (new URL(request.url).search) throw new IfLiveError("Supply the reviewed flight and IF schedule in the request body", "validation", 400);
    return ifJson({ success: true, data: await matchIfAircraftSchedule(auth.user.id, await request.json()) });
  } catch (error) { return ifRouteError(error); }
}
