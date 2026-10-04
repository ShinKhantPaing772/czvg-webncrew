import { createHash } from "node:crypto";
import { IF_LIVE_BASE_URL, IF_LIVE_CACHE_MS, IfLiveError, isIfUuid } from "./config";
import type { IfAircraft, IfAirport, IfContentAircraft, IfContentDirectory, IfContentLivery, IfOrganization, IfPosition, IfPositionView, IfSchedule, IfScheduleRequest, IfCrew } from "./types";
import { ifRequestTimeoutMs } from "./request-budget";

const cache = new Map<string, { data: unknown; expiresAt: number; timer: ReturnType<typeof setTimeout> }>();
const pending = new Map<string, Promise<unknown>>();
const budgets = new Map<string, { count: number; resetAt: number }>();
const IF_CONTENT_BASE_URL = "https://api.infiniteflight.com/public/v2";
export type IfReadOptions = { fresh?: boolean };

function cacheKey(token: string, path: string, baseUrl = IF_LIVE_BASE_URL) { return `${createHash("sha256").update(token).digest("hex")}:${baseUrl}${path}`; }

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

async function performRequest<T>(token: string, path: string, method: string, body?: unknown, baseUrl = IF_LIVE_BASE_URL): Promise<T> {
  spendBudget(token);
  const timeout = ifRequestTimeoutMs();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(timeout),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new IfLiveError("Infinite Flight did not confirm the request", "unavailable", 502, 60, method !== "GET");
  }
  if (response.redirected || (response.status >= 300 && response.status < 400)) {
    throw new IfLiveError("Infinite Flight returned an unexpected redirect", "redirect", 502, 60, method !== "GET");
  }
  if (!response.ok) {
    const retry = Number(response.headers.get("Retry-After"));
    const retryAfter = Number.isFinite(retry) && retry > 0 ? Math.min(retry, 3600) : 60;
    if (baseUrl === IF_CONTENT_BASE_URL && [401, 403].includes(response.status)) {
      throw new IfLiveError("IF rejected the server's IF_API key; verify its access before checking aircraft content or airport coordinates", "configuration", response.status, retryAfter);
    }
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

async function get<T>(token: string, path: string, baseUrl = IF_LIVE_BASE_URL, decode?: (value: unknown) => T): Promise<T> {
  const key = cacheKey(token, path, baseUrl); const found = cache.get(key);
  if (found && found.expiresAt > Date.now()) {
    try { return decode ? decode(found.data) : found.data as T; }
    catch (error) { clearTimeout(found.timer); cache.delete(key); throw error; }
  }
  if (found) { clearTimeout(found.timer); cache.delete(key); }
  const active = pending.get(key); if (active) return active.then(data => decode ? decode(data) : data as T);
  const request = performRequest<T>(token, path, "GET", undefined, baseUrl).then(data => {
    const validated = decode ? decode(data) : data;
    const entry: { data: T; expiresAt: number; timer: ReturnType<typeof setTimeout> } = { data: validated, expiresAt: Date.now() + IF_LIVE_CACHE_MS, timer: setTimeout(() => { if (cache.get(key) === entry) cache.delete(key); }, IF_LIVE_CACHE_MS) };
    const timer = entry.timer;
    timer.unref?.();
    cache.set(key, entry);
    return validated;
  }).finally(() => pending.delete(key));
  pending.set(key, request); return request;
}

function read<T>(token: string, path: string, options: IfReadOptions, baseUrl = IF_LIVE_BASE_URL, decode?: (value: unknown) => T): Promise<T> {
  // Operational decisions must bypass an earlier UI snapshot, including an unfinished cached read.
  return options.fresh ? performRequest<T>(token, path, "GET", undefined, baseUrl).then(data => decode ? decode(data) : data) : get<T>(token, path, baseUrl, decode);
}

function contentApiKey() {
  const key = process.env.IF_API?.trim();
  if (!key) throw new IfLiveError("Configure the server's IF_API key to verify aircraft content and airport coordinates", "configuration", 503);
  return key;
}

function validCoordinates(value: any) {
  return Number.isFinite(value?.latitude) && value.latitude >= -90 && value.latitude <= 90 &&
    Number.isFinite(value?.longitude) && value.longitude >= -180 && value.longitude <= 180;
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
  return entry && isIfUuid(entry.id) && isIfUuid(entry.aircraftId) && isIfUuid(entry.organizationId) && Number.isInteger(entry.status) && typeof entry.callsign === "string" &&
    typeof entry.originIcao === "string" && typeof entry.destinationIcao === "string" &&
    typeof entry.scheduledDepartureUtc === "string" && typeof entry.scheduledArrivalUtc === "string" &&
    Array.isArray(entry.crew) && entry.crew.every((crew: any) => isIfUuid(crew.userId) && (crew.role === 0 || crew.role === 1));
}

export async function getIfOrganizations(token: string) {
  return list<IfOrganization>(await get(token, "/live/organizations"), entry => entry && isIfUuid(entry.id) && typeof entry.name === "string");
}
export async function getIfFleet(token: string, organizationId: string, options: IfReadOptions = {}) {
  return list<IfAircraft>(await read(token, `/live/organizations/${id(organizationId)}/aircraft`, options), entry => entry && isIfUuid(entry.id) && isIfUuid(entry.aircraftId) && isIfUuid(entry.organizationId) && typeof entry.registration === "string" && typeof entry.isFleetActiveSlot === "boolean" && (entry.status === 0 || entry.status === 1));
}
export async function getIfSchedules(token: string, aircraftId: string, options: IfReadOptions = {}) {
  const instanceId = id(aircraftId);
  const path = `/live/aircraft/${instanceId}/schedules`;
  const value = await read(token, path, options);
  return list<IfSchedule>(value, entry => validSchedule(entry) && entry.aircraftId.toLowerCase() === instanceId);
}
function decodePosition(value: any, instanceId: string): IfPosition {
  if (value === null) throw new IfLiveError("IF has no persisted position for this aircraft; review its location in IF before starting", "position_unavailable", 409);
  if (!value || typeof value !== "object" || Array.isArray(value) || !isIfUuid(value.id) || value.id.toLowerCase() !== instanceId || !validCoordinates(value) ||
      !Number.isInteger(value.state) || value.state < 0 || value.state > 5 || typeof value.isOnGround !== "boolean" ||
      typeof value.updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/i.test(value.updatedAt) ||
      !Number.isFinite(Date.parse(value.updatedAt))) throw new IfLiveError("IF returned an invalid or mismatched aircraft position; review the aircraft in IF before starting", "invalid_response", 502);
  return { id: instanceId, state: value.state, isOnGround: value.isOnGround, latitude: value.latitude, longitude: value.longitude, updatedAt: value.updatedAt };
}

export async function getIfPosition(token: string, aircraftId: string, options: IfReadOptions = {}): Promise<IfPosition> {
  const instanceId = id(aircraftId);
  return read(token, `/live/aircraft/${instanceId}/position`, options, IF_LIVE_BASE_URL, value => decodePosition(value, instanceId));
}

/** UI snapshots expire with the original cached response, even after later callers read it. */
export async function getIfPositionSnapshot(token: string, aircraftId: string): Promise<{ position: IfPositionView; expiresAt: number }> {
  const instanceId = id(aircraftId);
  const value = await getIfPosition(token, instanceId);
  const entry = cache.get(cacheKey(token, `/live/aircraft/${instanceId}/position`));
  if (!entry || entry.expiresAt <= Date.now()) throw new IfLiveError("The temporary IF position expired; refresh to load it again", "unavailable", 503, 15);
  return { position: { state: value.state, isOnGround: value.isOnGround, latitude: value.latitude, longitude: value.longitude, updatedAt: value.updatedAt }, expiresAt: entry.expiresAt };
}

/** The stable content directory uses the existing server API key, never the organization's OAuth token. */
export async function getIfContentDirectory(options: IfReadOptions = {}): Promise<IfContentDirectory> {
  const key = contentApiKey();
  const [aircraftValue, liveryValue] = await Promise.all([
    read(key, "/aircraft", options, IF_CONTENT_BASE_URL),
    read(key, "/aircraft/liveries", options, IF_CONTENT_BASE_URL),
  ]);
  const aircraft = list<IfContentAircraft>(aircraftValue, entry => entry && isIfUuid(entry.id) && typeof entry.name === "string");
  const liveries = list<IfContentLivery>(liveryValue, entry => entry && isIfUuid(entry.id) && isIfUuid(entry.aircraftID) && typeof entry.aircraftName === "string" && typeof entry.liveryName === "string");
  return { aircraft, liveries };
}

/** Airport coordinates are a vicinity reference, not an aircraft's confirmed airport. */
export async function getIfAirport(airportIcao: string, options: IfReadOptions = {}): Promise<IfAirport> {
  const icao = typeof airportIcao === "string" ? airportIcao.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{1,8}$/.test(icao)) throw new IfLiveError("Departure airport code is invalid", "validation", 400);
  const value = await read<IfAirport>(contentApiKey(), `/airport/${icao}`, options, IF_CONTENT_BASE_URL);
  if (!value || typeof value.icao !== "string" || value.icao.toUpperCase() !== icao || !validCoordinates(value)) {
    throw new IfLiveError("IF could not provide valid coordinates for the departure airport; confirm the airport code and try again", "invalid_response", 502);
  }
  return { icao, latitude: value.latitude, longitude: value.longitude };
}

/** This is the documented 3D-airport list, not a complete airport directory or confirmed aircraft location. */
export async function getIf3DAirports(options: IfReadOptions = {}): Promise<IfAirport[]> {
  return read(contentApiKey(), "/airports", options, IF_CONTENT_BASE_URL, value => {
    const airports = list<IfAirport>(value, entry => entry && typeof entry.icao === "string" && /^[A-Z0-9]{1,8}$/i.test(entry.icao) && validCoordinates(entry));
    const seen = new Set<string>();
    return airports.map(airport => {
      const icao = airport.icao.toUpperCase();
      if (seen.has(icao)) throw new IfLiveError("IF returned duplicate airport identifiers", "invalid_response", 502);
      seen.add(icao);
      return { icao, latitude: airport.latitude, longitude: airport.longitude };
    });
  });
}

/** Derived nearby-airport views must not outlive the cached directory used to estimate them. */
export async function getIf3DAirportsSnapshot(): Promise<{ airports: IfAirport[]; expiresAt: number }> {
  const key = contentApiKey();
  const airports = await getIf3DAirports();
  const entry = cache.get(cacheKey(key, "/airports", IF_CONTENT_BASE_URL));
  if (!entry || entry.expiresAt <= Date.now()) throw new IfLiveError("The temporary IF airport reference expired; refresh to load it again", "unavailable", 503, 15);
  return { airports, expiresAt: entry.expiresAt };
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
