import { requirePermission } from "@/lib/server-auth";
import { disconnectIfConnection } from "@/lib/scheduling/infinite-flight/connection";
import { ifJson, ifRouteError } from "@/lib/scheduling/infinite-flight/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await requirePermission(request, "scheduling"); if (!auth.ok) return auth.response;
  try { await disconnectIfConnection(); return ifJson({ success: true }); }
  catch (error) { return ifRouteError(error); }
}
