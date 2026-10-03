import { requirePermission } from "@/lib/server-auth";
import { retryIfPublish } from "@/lib/scheduling/infinite-flight/publisher";
import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";
import { ifJson, ifRouteError } from "@/lib/scheduling/infinite-flight/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await requirePermission(request, "scheduling"); if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    if (!Number.isInteger(body?.flightId) || body.flightId <= 0 || !["retry", "overwrite", "recreate"].includes(body?.action)) throw new IfLiveError("Select a valid flight and retry action", "validation", 400);
    await retryIfPublish(body.flightId, body.action, auth.user.id); return ifJson({ success: true });
  } catch (error) { return ifRouteError(error); }
}
