import { getIfContentDirectory, getIfFleet } from "./client";
import { IfLiveError, isIfUuid } from "./config";
import type { IfAircraft, IfContentDirectory } from "./types";

export type IfAircraftCatalog = { ifaircraftid: string | null; ifliveryid: string | null };

function catalogId(value: string | null, label: string, optional = false) {
  if (optional && (value === null || value === "" || (typeof value === "string" && !value.trim()))) return null;
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!isIfUuid(normalized)) throw new IfLiveError(`The local aircraft catalog needs a valid IF ${label} ID before linking to the live fleet`, "binding", 409);
  return normalized;
}

/** v3 aircraftId may be either the model ID or a livery ID; resolve it through the official directory. */
export function assertIfAircraftContentMatches(catalog: IfAircraftCatalog, remote: IfAircraft, directory: IfContentDirectory) {
  const modelId = catalogId(catalog.ifaircraftid, "aircraft")!;
  const liveryId = catalogId(catalog.ifliveryid, "livery", true);
  if (!isIfUuid(remote.aircraftId)) throw new IfLiveError("The selected IF aircraft's content ID is invalid; refresh the fleet before linking", "binding", 409);
  const modelMatches = directory.aircraft.filter(row => row.id.toLowerCase() === modelId);
  if (modelMatches.length !== 1) throw new IfLiveError("The local aircraft type was not uniquely found in IF's content directory; update the aircraft catalog before linking", "binding", 409);
  if (liveryId) {
    const localLiveries = directory.liveries.filter(row => row.id.toLowerCase() === liveryId);
    if (localLiveries.length !== 1 || localLiveries[0].aircraftID.toLowerCase() !== modelId) {
      throw new IfLiveError("The local catalog livery is unknown or belongs to another IF aircraft type; update the catalog before linking", "binding", 409);
    }
  }
  const contentId = remote.aircraftId.toLowerCase();
  const remoteModels = directory.aircraft.filter(row => row.id.toLowerCase() === contentId);
  const remoteLiveries = directory.liveries.filter(row => row.id.toLowerCase() === contentId);
  if (remoteModels.length + remoteLiveries.length !== 1) {
    throw new IfLiveError("The selected IF aircraft's content ID could not be uniquely resolved; review the fleet and catalog before linking", "binding", 409);
  }
  const remoteModelId = remoteModels[0]?.id.toLowerCase() ?? remoteLiveries[0].aircraftID.toLowerCase();
  if (remoteModelId !== modelId) throw new IfLiveError("The selected IF live aircraft is a different aircraft type from the local catalog entry", "binding", 409);
  if (remoteLiveries.length && liveryId && contentId !== liveryId) {
    throw new IfLiveError("The selected IF live aircraft's livery does not match the local catalog entry", "binding", 409);
  }
  // A model-only content ID does not reveal a livery. Validate its type without claiming the livery was verified.
}

export async function validateIfAircraftBinding(input: {
  token: string; organizationId: string; ifAircraftId: string; catalog: IfAircraftCatalog; requireActive?: boolean;
}): Promise<IfAircraft> {
  if (!isIfUuid(input.organizationId) || !isIfUuid(input.ifAircraftId)) throw new IfLiveError("The IF organization or aircraft identifier is invalid", "validation", 400);
  // Fail before any request if the local catalog cannot be matched.
  catalogId(input.catalog.ifaircraftid, "aircraft"); catalogId(input.catalog.ifliveryid, "livery", true);
  const fleet = await getIfFleet(input.token, input.organizationId, { fresh: true });
  const matches = fleet.filter(row => row.id.toLowerCase() === input.ifAircraftId.toLowerCase());
  if (matches.length !== 1 || matches[0].organizationId.toLowerCase() !== input.organizationId.toLowerCase()) {
    throw new IfLiveError("The selected aircraft does not belong to the connected IF organization; refresh the fleet and select its aircraft", "binding", 409);
  }
  const aircraft = matches[0];
  if (aircraft.status !== 0) throw new IfLiveError("The selected IF aircraft has been deleted; select an active aircraft", "binding", 409);
  if (input.requireActive !== false && !aircraft.isFleetActiveSlot) {
    throw new IfLiveError("The selected IF aircraft is in storage; activate it in IF before linking or publishing", "binding", 409);
  }
  assertIfAircraftContentMatches(input.catalog, aircraft, await getIfContentDirectory());
  return aircraft;
}
