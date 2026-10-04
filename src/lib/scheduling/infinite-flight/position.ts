import type { IfAirport, IfPositionView } from "./types";

export type IfNearbyAirportEstimate = { icao: string; distanceNm: number };
const EARTH_RADIUS_NM = 3440.065;
const MAX_DISTANCE_NM = 5;
const AMBIGUOUS_DISTANCE_NM = 0.25;

function coordinatesValid(value: { latitude: number; longitude: number }) {
  return Number.isFinite(value.latitude) && value.latitude >= -90 && value.latitude <= 90 &&
    Number.isFinite(value.longitude) && value.longitude >= -180 && value.longitude <= 180;
}

function distanceNm(position: { latitude: number; longitude: number }, airport: IfAirport) {
  const radians = Math.PI / 180;
  const latitudes = (airport.latitude - position.latitude) * radians;
  const longitudes = (airport.longitude - position.longitude) * radians;
  const haversine = Math.sin(latitudes / 2) ** 2 + Math.cos(position.latitude * radians) * Math.cos(airport.latitude * radians) * Math.sin(longitudes / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}

/** A temporary proximity estimate only; never use it to record an actual arrival or change the confirmed airport. */
export function estimateNearbyIfAirport(position: Pick<IfPositionView, "isOnGround" | "latitude" | "longitude">, airports: readonly IfAirport[]): IfNearbyAirportEstimate | null {
  if (!position || position.isOnGround !== true || !coordinatesValid(position)) return null;
  const unique = new Map<string, IfAirport>();
  for (const airport of airports) {
    if (!airport || typeof airport.icao !== "string" || !/^[A-Z0-9]{1,8}$/i.test(airport.icao) || !coordinatesValid(airport)) return null;
    const icao = airport.icao.toUpperCase();
    const duplicate = unique.get(icao);
    if (duplicate && (duplicate.latitude !== airport.latitude || duplicate.longitude !== airport.longitude)) return null;
    unique.set(icao, { icao, latitude: airport.latitude, longitude: airport.longitude });
  }
  const candidates = [...unique.values()].map(airport => ({ icao: airport.icao, distanceNm: distanceNm(position, airport) }))
    .sort((left, right) => left.distanceNm - right.distanceNm);
  const closest = candidates[0];
  if (!closest || closest.distanceNm > MAX_DISTANCE_NM || (candidates[1] && candidates[1].distanceNm - closest.distanceNm <= AMBIGUOUS_DISTANCE_NM + Number.EPSILON * 16)) return null;
  return closest;
}
