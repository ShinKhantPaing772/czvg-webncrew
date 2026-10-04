import { requireCrewAuth } from "@/lib/server-auth";
import { ifRouteError } from "@/lib/scheduling/infinite-flight/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const auth = await requireCrewAuth(request);
    if (!auth.ok) { auth.response.headers.set("Cache-Control", "no-store"); return auth.response; }
    return Response.json({ success: false, error: "IF aircraft positions are available to scheduling administrators only." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return ifRouteError(error); }
}
