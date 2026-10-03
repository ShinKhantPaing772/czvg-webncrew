import { requirePermission } from "@/lib/server-auth";
import { configureIfOrganization } from "@/lib/scheduling/infinite-flight/connection";
import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";
import { ifJson, ifRouteError } from "@/lib/scheduling/infinite-flight/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await requirePermission(request, "scheduling"); if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    if (typeof body?.organizationId !== "string") throw new IfLiveError("Select an IF organization", "validation", 400);
    await configureIfOrganization(body.organizationId); return ifJson({ success: true });
  } catch (error) { return ifRouteError(error); }
}
