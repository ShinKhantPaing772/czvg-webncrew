import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/server-auth";
import { storeIfConnection } from "@/lib/scheduling/infinite-flight/connection";
import { IfLiveError, getIfLiveConfig } from "@/lib/scheduling/infinite-flight/config";
import { IF_STATE_COOKIE, exchangeIfAuthorization, readIfAuthorizationState, revokeIfAuthorization, type IfTokenSet } from "@/lib/scheduling/infinite-flight/oauth";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const config = getIfLiveConfig();
  const callback = config.oauthSetup.callbackUrl ? new URL(config.oauthSetup.callbackUrl) : null;
  const destination = callback ? new URL("/crew/admin/scheduling", callback) : null;
  let tokens: IfTokenSet | null = null; let stored = false;
  try {
    if (!callback) throw new IfLiveError("The registered IF callback URL is not configured", "configuration");
    if (request.nextUrl.origin !== callback.origin || request.nextUrl.pathname !== callback.pathname) {
      throw new IfLiveError("OAuth callback does not match the registered site and path", "callback_origin", 400);
    }
    const encrypted = request.cookies.get(IF_STATE_COOKIE)?.value; const state = request.nextUrl.searchParams.get("state");
    if (!encrypted || !state) throw new IfLiveError("OAuth state missing", "oauth_state", 400);
    const original = readIfAuthorizationState(encrypted, state);
    const auth = await requirePermission(new Request(request.url, { headers: { Authorization: `Bearer ${original.token}` } }), "scheduling");
    if (!auth.ok || auth.user.id !== original.pilotId) throw new IfLiveError("The initiating admin session expired or lost scheduling access", "authentication", 401);
    if (request.nextUrl.searchParams.has("error")) throw new IfLiveError("IF authorization was declined", "consent", 400);
    const code = request.nextUrl.searchParams.get("code"); if (!code || code.length > 4096) throw new IfLiveError("Authorization code missing", "oauth_code", 400);
    tokens = await exchangeIfAuthorization(code, original.verifier, original.redirectUri);
    await storeIfConnection(auth.user.id, tokens); stored = true;
    destination!.searchParams.set("if", "connected");
  } catch (error) {
    if (tokens && !stored) {
      // A simultaneous connection must not leave an untracked grant behind.
      for (const [token, type] of [[tokens.refreshToken, "refresh_token"], [tokens.accessToken, "access_token"]] as const) {
        if (!token) continue;
        try { await revokeIfAuthorization(token, type); } catch { /* Do not expose credentials or provider response bodies. */ }
      }
    }
    destination?.searchParams.set("if", "error");
    destination?.searchParams.set("reason", error instanceof IfLiveError ? error.code : "unavailable");
  }
  const response = destination ? NextResponse.redirect(destination) : NextResponse.json({ success: false, error: "The registered IF callback URL is not configured", code: "configuration" }, { status: 503 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(IF_STATE_COOKIE, "", { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: request.nextUrl.pathname, maxAge: 0 });
  return response;
}
