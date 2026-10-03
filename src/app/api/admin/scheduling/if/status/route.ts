import { requirePermission } from "@/lib/server-auth";
import { ifIntegrationStatus } from "@/lib/scheduling/infinite-flight/connection";
import { ifJson, ifRouteError } from "@/lib/scheduling/infinite-flight/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const auth = await requirePermission(request, "scheduling"); if (!auth.ok) return auth.response;
  try { return ifJson({ success: true, data: await ifIntegrationStatus() }); }
  catch (error) { return ifRouteError(error); }
}
