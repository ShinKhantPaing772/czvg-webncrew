import { Buffer } from "node:buffer";

export const IF_LIVE_BASE_URL = "https://api.infiniteflight.com/public/v3";
export const IF_LIVE_AUTH_URL = "https://api.infiniteflight.com/auth/v2";
export const IF_LIVE_SCOPES = "openid profile offline_access live:organizations.read live:aircraft.read live:schedules.read live:schedules.write";
export const IF_LIVE_CACHE_MS = 60_000;

export class IfLiveError extends Error {
  constructor(
    message: string,
    public readonly code = "unavailable",
    public readonly status = 503,
    public readonly retryAfterSeconds = 60,
    public readonly uncertainWrite = false,
  ) { super(message); this.name = "IfLiveError"; }
}

function enabled(name: string) { return process.env[name]?.trim().toLowerCase() === "true"; }

export function tokenEncryptionKey() {
  const value = process.env.IF_LIVE_TOKEN_ENCRYPTION_KEY?.trim() ?? "";
  const key = Buffer.from(value, "base64");
  if (!value || key.length !== 32 || key.toString("base64") !== value) {
    throw new IfLiveError("IF token encryption requires a base64 encoded 32-byte key", "configuration");
  }
  return key;
}

export function getIfLiveConfig() {
  const previewEnabled = enabled("IF_LIVE_PREVIEW_ENABLED");
  const autoPublishEnabled = enabled("IF_LIVE_AUTO_PUBLISH_ENABLED");
  const durableBindingsAllowed = enabled("IF_LIVE_DURABLE_BINDINGS_ALLOWED");
  const clientId = process.env.IF_LIVE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.IF_LIVE_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.IF_LIVE_REDIRECT_URI?.trim() ?? "";
  const revocationUrl = process.env.IF_LIVE_REVOCATION_URL?.trim() ?? "";
  const disabledReasons: string[] = [];
  if (!previewEnabled) disabledReasons.push("Infinite Flight v3 preview is disabled");
  if (!clientId || !clientSecret) disabledReasons.push("Infinite Flight OAuth client credentials are missing");
  try {
    const url = new URL(redirectUri);
    if (url.pathname !== "/api/admin/scheduling/if/callback" || url.search || url.hash ||
        (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
      throw new Error("invalid callback");
    }
  } catch { disabledReasons.push("A registered IF OAuth callback URL is required"); }
  try {
    const url = new URL(revocationUrl);
    if (url.protocol !== "https:" || !["api.infiniteflight.com", "auth.infiniteflight.com"].includes(url.hostname) || url.username || url.password || url.hash) throw new Error("invalid revoke URL");
  } catch { disabledReasons.push("The supported IF OAuth revocation URL must be configured"); }
  try { tokenEncryptionKey(); } catch { disabledReasons.push("The IF token encryption key is missing or invalid"); }
  return { previewEnabled, autoPublishEnabled, durableBindingsAllowed, clientId, clientSecret, redirectUri, revocationUrl, configured: disabledReasons.length === 0, disabledReasons };
}

export function requireIfLiveConfig(requirePublishing = false) {
  const config = getIfLiveConfig();
  if (!config.configured) throw new IfLiveError(config.disabledReasons.join("; "), "configuration");
  if (requirePublishing && (!config.autoPublishEnabled || !config.durableBindingsAllowed)) {
    throw new IfLiveError("Automatic IF publishing requires preview access and explicit permission to retain durable mapping identifiers", "disabled");
  }
  return config;
}

/** Disabling preview access must not prevent revoking an existing OAuth grant. */
export function requireIfRevocationConfig() {
  const config = getIfLiveConfig();
  const reasons = config.disabledReasons.filter(reason => !["Infinite Flight v3 preview is disabled", "A registered IF OAuth callback URL is required"].includes(reason));
  if (reasons.length) throw new IfLiveError(reasons.join("; "), "configuration");
  return config;
}

export function isIfUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) && value !== "00000000-0000-0000-0000-000000000000";
}
