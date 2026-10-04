import { Buffer } from "node:buffer";

export const IF_LIVE_BASE_URL = "https://api.infiniteflight.com/public/v3";
export const IF_LIVE_AUTH_URL = "https://api.infiniteflight.com/auth/v2";
export const IF_LIVE_SCOPES = "openid profile offline_access live:organizations.read live:aircraft.read live:schedules.read live:schedules.write";
export const IF_LIVE_CACHE_MS = 60_000;
export const IF_CALLBACK_PATHS = ["/oauth/callback", "/api/admin/scheduling/if/callback"] as const;

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
  let callbackUrl: string | null = null;
  let revocationReady = false;
  let encryptionReady = false;
  if (!previewEnabled) disabledReasons.push("Infinite Flight v3 preview is disabled");
  if (!clientId || !clientSecret) disabledReasons.push("Infinite Flight OAuth client credentials are missing");
  try {
    const url = new URL(redirectUri);
    if (!(IF_CALLBACK_PATHS as readonly string[]).includes(url.pathname) || url.username || url.password || url.search || url.hash ||
        (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
      throw new Error("invalid callback");
    }
    callbackUrl = url.toString();
  } catch { disabledReasons.push("A registered IF OAuth callback URL is required"); }
  try {
    const url = new URL(revocationUrl);
    if (url.protocol !== "https:" || !["api.infiniteflight.com", "auth.infiniteflight.com"].includes(url.hostname) || url.username || url.password || url.hash) throw new Error("invalid revoke URL");
    revocationReady = true;
  } catch {
    if (revocationUrl) disabledReasons.push("The configured IF OAuth revocation URL is invalid");
  }
  try { tokenEncryptionKey(); encryptionReady = true; } catch { disabledReasons.push("The IF token encryption key is missing or invalid"); }
  const bindingDisabledReasons = [
    ...disabledReasons,
    ...(!durableBindingsAllowed ? ["Durable IF mapping retention has not been authorized"] : []),
  ];
  const publishingDisabledReasons = [
    ...disabledReasons,
    ...(!autoPublishEnabled ? ["Automatic IF publishing is disabled"] : []),
    ...(!durableBindingsAllowed ? ["Durable IF mapping retention has not been authorized"] : []),
  ];
  const oauthSetup = { callbackUrl, checks: [
    { id: "preview", label: "Preview access enabled", ready: previewEnabled, required: true },
    { id: "client", label: "OAuth client configured", ready: Boolean(clientId && clientSecret), required: true },
    { id: "callback", label: "Registered callback configured", ready: Boolean(callbackUrl), required: true },
    { id: "revocation", label: "Supported revocation configured", ready: revocationReady, required: false },
    { id: "encryption", label: "Token encryption configured", ready: encryptionReady, required: true },
  ] };
  return {
    previewEnabled, autoPublishEnabled, durableBindingsAllowed, clientId, clientSecret, redirectUri, revocationUrl,
    configured: disabledReasons.length === 0, disabledReasons, oauthSetup,
    bindingReady: bindingDisabledReasons.length === 0, bindingDisabledReasons,
    revocationConfigured: revocationReady, publishingReady: publishingDisabledReasons.length === 0, publishingDisabledReasons,
  };
}

export function requireIfLiveConfig(requirePublishing = false) {
  const config = getIfLiveConfig();
  if (!config.configured) throw new IfLiveError(config.disabledReasons.join("; "), "configuration");
  if (requirePublishing && !config.publishingReady) {
    throw new IfLiveError(config.publishingDisabledReasons.join("; "), "disabled");
  }
  return config;
}

/** Disabling preview access must not prevent revoking an existing OAuth grant. */
export function requireIfRevocationConfig() {
  const config = getIfLiveConfig();
  const reasons = config.disabledReasons.filter(reason => !["Infinite Flight v3 preview is disabled", "A registered IF OAuth callback URL is required"].includes(reason));
  if (!config.revocationUrl) reasons.push("The supported IF OAuth revocation URL must be configured");
  if (reasons.length) throw new IfLiveError(reasons.join("; "), "configuration");
  return config;
}

export function isIfUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) && value !== "00000000-0000-0000-0000-000000000000";
}
