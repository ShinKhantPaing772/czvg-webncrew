import { IF_LIVE_AUTH_URL, IF_LIVE_SCOPES, requireIfLiveConfig, requireIfRevocationConfig, IfLiveError } from "./config";
import { createIfPkce, encryptIfSecret, decryptIfSecret, constantTimeEqual } from "./crypto";
import { ifRequestTimeoutMs } from "./request-budget";

export const IF_STATE_COOKIE = "wnc_if_oauth_state";
export const IF_STATE_TTL_SECONDS = 600;
type OAuthState = { state: string; verifier: string; token: string; pilotId: number; expiresAt: number; redirectUri: string };
export type IfTokenSet = { accessToken: string; refreshToken: string | null; expiresAt: Date };

export function startIfAuthorization(pilotId: number, token: string) {
  const config = requireIfLiveConfig(); const pkce = createIfPkce();
  const state: OAuthState = { state: pkce.state, verifier: pkce.verifier, token, pilotId, expiresAt: Date.now() + IF_STATE_TTL_SECONDS * 1000, redirectUri: config.redirectUri };
  const url = new URL(`${IF_LIVE_AUTH_URL}/connect/authorize`);
  url.search = new URLSearchParams({ response_type: "code", client_id: config.clientId, redirect_uri: config.redirectUri, scope: IF_LIVE_SCOPES, state: pkce.state, code_challenge: pkce.challenge, code_challenge_method: "S256" }).toString();
  return { authorizationUrl: url.toString(), encryptedState: encryptIfSecret(JSON.stringify(state)) };
}

export function readIfAuthorizationState(encrypted: string, returnedState: string): OAuthState {
  try {
    const parsed = JSON.parse(decryptIfSecret(encrypted));
    if (!parsed || !Number.isSafeInteger(parsed.pilotId) || parsed.pilotId <= 0 || typeof parsed.verifier !== "string" || typeof parsed.token !== "string" ||
      typeof parsed.redirectUri !== "string" || parsed.redirectUri !== requireIfLiveConfig().redirectUri ||
      typeof parsed.state !== "string" || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= Date.now() || !constantTimeEqual(parsed.state, returnedState)) throw new Error("invalid state");
    return parsed;
  } catch { throw new IfLiveError("OAuth connection expired or could not be verified; start the connection again", "oauth_state", 400); }
}

async function tokenRequest(values: Record<string, string>): Promise<IfTokenSet> {
  const config = requireIfLiveConfig(); const timeout = ifRequestTimeoutMs(); let response: Response;
  try {
    response = await fetch(`${IF_LIVE_AUTH_URL}/connect/token`, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeout),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...values }),
    });
  } catch { throw new IfLiveError("IF token exchange was not confirmed; reconnect before trying again", "oauth_exchange", 502); }
  if (response.redirected || (response.status >= 300 && response.status < 400)) throw new IfLiveError("IF token exchange returned an unsupported redirect; reconnect before trying again", "oauth_exchange", 502);
  if (!response.ok) throw new IfLiveError("IF did not authorize the connection; check client access and reconnect", response.status >= 500 ? "oauth_exchange" : "reauth_required", response.status >= 500 ? 502 : 401);
  let value: Record<string, unknown>;
  try { value = await response.json(); }
  catch { throw new IfLiveError("IF token exchange returned an unsupported response", "oauth_exchange", 502); }
  if (!value || typeof value.access_token !== "string" || !value.access_token.trim() ||
      typeof value.token_type !== "string" || value.token_type.toLowerCase() !== "bearer" ||
      typeof value.expires_in !== "number" || !Number.isFinite(value.expires_in) || value.expires_in <= 0) {
    throw new IfLiveError("IF token exchange returned an unsupported response", "oauth_exchange", 502);
  }
  const expiresAt = new Date(Date.now() + value.expires_in * 1000);
  if (!Number.isFinite(expiresAt.getTime())) throw new IfLiveError("IF token exchange returned an unsupported response", "oauth_exchange", 502);
  return { accessToken: value.access_token, refreshToken: typeof value.refresh_token === "string" && value.refresh_token.trim() ? value.refresh_token : null, expiresAt };
}

export async function exchangeIfAuthorization(code: string, verifier: string, redirectUri?: string) {
  const config = requireIfLiveConfig();
  if (redirectUri !== undefined && redirectUri !== config.redirectUri) throw new IfLiveError("The registered callback changed; start the connection again", "oauth_state", 400);
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri ?? config.redirectUri, code_verifier: verifier });
}
export async function refreshIfAuthorization(refreshToken: string) { return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }); }

export async function revokeIfAuthorization(token: string, type: "access_token" | "refresh_token") {
  const config = requireIfRevocationConfig(); const timeout = ifRequestTimeoutMs(); let response: Response;
  try {
    response = await fetch(config.revocationUrl, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeout),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, token_type_hint: type, client_id: config.clientId, client_secret: config.clientSecret }),
    });
  } catch { throw new IfLiveError("IF revocation was not confirmed; retry disconnect", "revocation", 502); }
  if (!response.ok) throw new IfLiveError("IF revocation was not confirmed; retry disconnect", "revocation", 502);
}
