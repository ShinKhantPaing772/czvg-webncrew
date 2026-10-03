import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/server-auth";
import { IfLiveConnection } from "@/lib/scheduling/models";
import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";
import { IF_STATE_COOKIE, IF_STATE_TTL_SECONDS, startIfAuthorization } from "@/lib/scheduling/infinite-flight/oauth";
import { ifRouteError } from "@/lib/scheduling/infinite-flight/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await requirePermission(request, "scheduling"); if (!auth.ok) return auth.response;
  try {
    const row = await IfLiveConnection.findByPk(1);
    if (row?.access_token_encrypted || row?.refresh_token_encrypted) throw new IfLiveError("Disconnect the existing IF account before connecting again", "already_connected", 409);
    const { authorizationUrl, encryptedState } = startIfAuthorization(auth.user.id, auth.token);
    const response = NextResponse.json({ success: true, authorizationUrl }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(IF_STATE_COOKIE, encryptedState, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/admin/scheduling/if/callback", maxAge: IF_STATE_TTL_SECONDS });
    return response;
  } catch (error) { return ifRouteError(error); }
}
