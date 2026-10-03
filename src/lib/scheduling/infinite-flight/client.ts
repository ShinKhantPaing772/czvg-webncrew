import { createHash } from "node:crypto";
import { IF_LIVE_BASE_URL, IF_LIVE_CACHE_MS, IfLiveError, isIfUuid } from "./config";
import type { IfAircraft, IfOrganization, IfPosition, IfSchedule, IfScheduleRequest, IfCrew } from "./types";
import { ifRequestTimeoutMs } from "./request-budget";

const cache = new Map<string, { data: unknown; expiresAt: number; timer: ReturnType<typeof setTimeout> }>();
const pending = new Map<string, Promise<unknown>>();
const budgets = new Map<string, { count: number; resetAt: number }>();

function cacheKey(token: string, path: string) { return `${createHash("sha256").update(token).digest("hex")}:${path}`; }

export function clearIfLiveCache() {
  for (const entry of cache.values()) clearTimeout(entry.timer);
  cache.clear(); pending.clear(); budgets.clear();
}

function spendBudget(token: string) {
  const key = createHash("sha256").update(token).digest("hex"); const now = Date.now();
  const bucket = budgets.get(key);
  if (bucket && now < bucket.resetAt) {
    if (bucket.count >= 30) throw new IfLiveError("IF request budget reached; try again shortly", "rate_limited", 429, Math.ceil((bucket.resetAt - now) / 1000));
    bucket.count += 1;
  } else { budgets.set(key, { count: 1, resetAt: now + 60_000 }); }
}

async function performRequest<T>(token: string, path: string, method: string, body?: unknown): Promise<T> {
  spendBudget(token);
  const timeout = ifRequestTimeoutMs();
  let response: Response;
  try {
    response = await fetch(`${IF_LIVE_BASE_URL}${path}`, {
      method, cache: "no-store", signal: AbortSignal.timeout(timeout),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new IfLiveError("Infinite Flight did not confirm the request", "unavailable", 502, 60, method !== "GET");
  }
  if (!response.ok) {
    const retry = Number(response.headers.get("Retry-After"));
    const retryAfter = Number.isFinite(retry) && retry > 0 ? Math.min(retry, 3600) : 60;
    const message = response.status === 403 ? "IF denied this operation; the connected account needs the requested scopes and organization owner/admin access" :
      response.status === 401 ? "IF authorization expired; reconnect the organization account" :
      response.status === 429 ? "Infinite Flight rate limit reached" : `Infinite Flight returned HTTP ${response.status}`;
    throw new IfLiveError(message, response.status === 429 ? "rate_limited" : response.status === 403 ? "forbidden" : response.status === 401 ? "reauth_required" : "upstream", response.status, retryAfter, method !== "GET" && response.status >= 500);
  }
  let envelope: { errorCode?: unknown; result?: unknown };
  try { envelope = await response.json(); }
  catch { throw new IfLiveError("IF returned an unreadable response", "invalid_response", 502, 60, method !== "GET"); }
  if (!envelope || !Number.isInteger(envelope.errorCode) || !("result" in envelope)) {
    throw new IfLiveError("IF rejected the operation or returned an unsupported preview response", "invalid_response", 502, 60, method !== "GET");
  }
  if (envelope.errorCode !== 0) throw new IfLiveError(`IF rejected the operation (error ${envelope.errorCode})`, "upstream_rejected", 400);
  return envelope.result as T;
}

async function get<T>(token: string, path: string): Promise<T> {
  const key = cacheKey(token, path); const found = cache.get(key);
  if (found && found.expiresAt > Date.now()) return found.data as T;
  const active = pending.get(key); if (active) return active as Promise<T>;
  const request = performRequest<T>(token, path, "GET").then(data => {
    const timer = setTimeout(() => { cache.delete(key); }, IF_LIVE_CACHE_MS);
    timer.unref?.();
    cache.set(key, { data, expiresAt: Date.now() + IF_LIVE_CACHE_MS, timer });
    return data;
  }).finally(() => pending.delete(key));
  pending.set(key, request); return request;
}

function invalidate(token: string, paths: string[]) {
  for (const path of paths) {
    const key = cacheKey(token, path); const entry = cache.get(key);
    if (entry) clearTimeout(entry.timer); cache.delete(key);
  }
}

function id(value: string) { if (!isIfUuid(value)) throw new IfLiveError("An IF identifier is invalid", "validation", 400); return value.toLowerCase(); }
function list<T>(value: unknown, valid: (entry: any) => boolean): T[] {
  if (!Array.isArray(value) || !value.every(valid)) throw new IfLiveError("IF preview response format changed", "invalid_response", 502);
  return value as T[];
}
function validSchedule(entry: any) {
  return entry && isIfUuid(entry.id) && typeof entry.status === "number" && typeof entry.callsign === "string" &&
    typeof entry.originIcao === "string" && typeof entry.destinationIcao === "string" &&
    typeof entry.scheduledDepartureUtc === "string" && typeof entry.scheduledArrivalUtc === "string" &&
    Array.isArray(entry.crew) && entry.crew.every((crew: any) => isIfUuid(crew.userId) && (crew.role === 0 || crew.role === 1));
}

export async function getIfOrganizations(token: string) {
  return list<IfOrganization>(await get(token, "/live/organizations"), entry => entry && isIfUuid(entry.id) && typeof entry.name === "string");
}
export async function getIfFleet(token: string, organizationId: string) {
  return list<IfAircraft>(await get(token, `/live/organizations/${id(organizationId)}/aircraft`), entry => entry && isIfUuid(entry.id) && isIfUuid(entry.organizationId) && typeof entry.registration === "string" && typeof entry.isFleetActiveSlot === "boolean");
}
export async function getIfSchedules(token: string, aircraftId: string, options: { fresh?: boolean } = {}) {
  const path = `/live/aircraft/${id(aircraftId)}/schedules`;
  // Publishing decisions must not share an earlier UI snapshot or pending cached read.
  const value = options.fresh ? await performRequest(token, path, "GET") : await get(token, path);
  return list<IfSchedule>(value, validSchedule);
}
export async function getIfPosition(token: string, aircraftId: string) {
  const value = await get<IfPosition>(token, `/live/aircraft/${id(aircraftId)}/position`);
  if (!value || !isIfUuid(value.id) || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || typeof value.updatedAt !== "string") throw new IfLiveError("IF position response format changed", "invalid_response", 502);
  return value;
}
export async function createIfSchedule(token: string, aircraftId: string, body: IfScheduleRequest) {
  const value = await performRequest<IfSchedule>(token, `/live/aircraft/${id(aircraftId)}/schedules`, "POST", body);
  invalidate(token, [`/live/aircraft/${id(aircraftId)}/schedules`]);
  if (!validSchedule(value)) throw new IfLiveError("IF did not return a supported schedule", "invalid_response", 502, 60, true);
  return value;
}
export async function updateIfSchedule(token: string, aircraftId: string, scheduleId: string, body: IfScheduleRequest) {
  const value = await performRequest<IfSchedule>(token, `/live/schedules/${id(scheduleId)}`, "PUT", body);
  invalidate(token, [`/live/aircraft/${id(aircraftId)}/schedules`]);
  if (!validSchedule(value)) throw new IfLiveError("IF did not return a supported schedule", "invalid_response", 502, 60, true);
  return value;
}
export async function deleteIfSchedule(token: string, aircraftId: string, scheduleId: string) {
  const value = await performRequest<boolean>(token, `/live/schedules/${id(scheduleId)}`, "DELETE");
  invalidate(token, [`/live/aircraft/${id(aircraftId)}/schedules`]);
  if (value !== true) throw new IfLiveError("IF did not confirm schedule removal", "invalid_response", 502, 60, true);
}
export async function putIfCrew(token: string, aircraftId: string, scheduleId: string, crew: IfCrew) {
  const value = await performRequest<IfSchedule>(token, `/live/schedules/${id(scheduleId)}/crew/${id(crew.userId)}`, "PUT", { role: crew.role });
  invalidate(token, [`/live/aircraft/${id(aircraftId)}/schedules`]);
  if (!validSchedule(value)) throw new IfLiveError("IF did not confirm crew assignment", "invalid_response", 502, 60, true);
  return value;
}
export async function removeIfCrew(token: string, aircraftId: string, scheduleId: string, userId: string) {
  const value = await performRequest<IfSchedule>(token, `/live/schedules/${id(scheduleId)}/crew/${id(userId)}`, "DELETE");
  invalidate(token, [`/live/aircraft/${id(aircraftId)}/schedules`]);
  if (!validSchedule(value)) throw new IfLiveError("IF did not confirm crew removal", "invalid_response", 502, 60, true);
  return value;
}
export async function reorderIfSchedule(token: string, aircraftId: string, scheduleId: string, afterId: string | null) {
  const value = await performRequest<boolean>(token, `/live/aircraft/${id(aircraftId)}/schedules/reorder`, "PUT", { scheduleId: id(scheduleId), afterId: afterId ? id(afterId) : null });
  invalidate(token, [`/live/aircraft/${id(aircraftId)}/schedules`]);
  if (value !== true) throw new IfLiveError("IF did not confirm schedule ordering", "invalid_response", 502, 60, true);
}
