import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/server-auth";
import { storeIfConnection } from "@/lib/scheduling/infinite-flight/connection";
import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";
import { IF_STATE_COOKIE, exchangeIfAuthorization, readIfAuthorizationState, revokeIfAuthorization, type IfTokenSet } from "@/lib/scheduling/infinite-flight/oauth";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const destination = new URL("/crew/admin/scheduling", request.url);
  let tokens: IfTokenSet | null = null; let stored = false;
  try {
    const encrypted = request.cookies.get(IF_STATE_COOKIE)?.value; const state = request.nextUrl.searchParams.get("state");
    if (!encrypted || !state) throw new IfLiveError("OAuth state missing", "oauth_state", 400);
    const original = readIfAuthorizationState(encrypted, state);
    const auth = await requirePermission(new Request(request.url, { headers: { Authorization: `Bearer ${original.token}` } }), "scheduling");
    if (!auth.ok || auth.user.id !== original.pilotId) throw new IfLiveError("The initiating admin session expired or lost scheduling access", "authentication", 401);
    if (request.nextUrl.searchParams.has("error")) throw new IfLiveError("IF authorization was declined", "consent", 400);
    const code = request.nextUrl.searchParams.get("code"); if (!code || code.length > 4096) throw new IfLiveError("Authorization code missing", "oauth_code", 400);
    tokens = await exchangeIfAuthorization(code, original.verifier);
    await storeIfConnection(auth.user.id, tokens); stored = true;
    destination.searchParams.set("if", "connected");
  } catch (error) {
    if (tokens && !stored) {
      // A simultaneous connection must not leave an untracked grant behind.
      try { if (tokens.refreshToken) await revokeIfAuthorization(tokens.refreshToken, "refresh_token"); await revokeIfAuthorization(tokens.accessToken, "access_token"); } catch { /* Do not expose credentials or provider response bodies. */ }
    }
    destination.searchParams.set("if", "error");
    destination.searchParams.set("reason", error instanceof IfLiveError ? error.code : "unavailable");
  }
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(IF_STATE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/admin/scheduling/if/callback", maxAge: 0 });
  return response;
}
