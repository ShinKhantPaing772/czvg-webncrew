import { createHash } from "node:crypto";
import { scheduleMarker } from "./itinerary";
import type { IfSchedule } from "./types";
import { meaningfulIfScheduleTime } from "./schedule-time";
export { meaningfulIfScheduleTime } from "./schedule-time";

export type IfManagedFlight = { id: number; public_id: string; if_schedule_id: string | null; status: string; publishing_state?: string };
export type IfAircraftScheduleView = {
  id: string; callsign: string; flightType: number; originIcao: string; destinationIcao: string;
  scheduledDepartureUtc: string | null; scheduledArrivalUtc: string | null;
  status: number; crew: IfSchedule["crew"]; sequence: number | null;
  fingerprint: string; managedFlightId: number | null; editable: boolean; editDisabledReason: string | null;
  matchable: boolean; matchDisabledReason: string | null;
};

/** Opaque optimistic concurrency token. Its source fields remain transient. */
export function ifScheduleFingerprint(row: IfSchedule): string {
  return createHash("sha256").update(JSON.stringify({
    id: row.id.toLowerCase(), aircraftId: row.aircraftId.toLowerCase(), organizationId: row.organizationId.toLowerCase(),
    callsign: row.callsign, flightType: row.flightType, originIcao: row.originIcao, destinationIcao: row.destinationIcao,
    scheduledDepartureUtc: row.scheduledDepartureUtc, scheduledArrivalUtc: row.scheduledArrivalUtc,
    briefing: row.briefing ?? null, flightPlan: row.flightPlan ?? null,
    status: row.status, sequence: row.sequence ?? null, updatedAt: row.updatedAt ?? null,
    actualDepartureUtc: row.actualDepartureUtc ?? null, actualArrivalUtc: row.actualArrivalUtc ?? null,
    crew: row.crew.map(member => ({ userId: member.userId.toLowerCase(), role: member.role })).sort((a, b) => a.userId.localeCompare(b.userId)),
  })).digest("hex");
}

function matchesManagedFlight(row: IfSchedule, flight: IfManagedFlight): boolean {
  return flight.if_schedule_id?.toLowerCase() === row.id.toLowerCase() || Boolean(row.briefing?.includes(scheduleMarker(flight.public_id)));
}

export function ifScheduleManagedFlight(row: IfSchedule, flights: readonly IfManagedFlight[]): IfManagedFlight | undefined {
  return flights.find(flight => matchesManagedFlight(row, flight));
}

export function isIfScheduleVisibleToPilot(row: IfSchedule, flights: readonly IfManagedFlight[]): boolean {
  // Local cancellation/rejection is authoritative while publishing catches up.
  return row.status !== 9 && !flights.some(flight => (flight.status === "cancelled" || flight.status === "rejected") && matchesManagedFlight(row, flight));
}

export function toIfAircraftScheduleView(row: IfSchedule, flights: readonly IfManagedFlight[] = [], canEdit = false): IfAircraftScheduleView {
  const managed = ifScheduleManagedFlight(row, flights);
  const marker = /\[WNC schedule:[^\]]*\]/i.test(row.briefing ?? "");
  const editDisabledReason = row.status === 11 || meaningfulIfScheduleTime(row.actualArrivalUtc) ? "Arrived flights are locked" :
    row.status === 9 ? "Cancelled flights are locked" :
      ![1, 2, 3, 4, 6, 7, 8, 10].includes(row.status) ? "This flight cannot be edited in its current IF state" :
        managed || marker ? "Amend this app-managed flight through the local scheduling controls" :
          !canEdit ? "Scheduling administrator access and an enabled IF connection are required" : null;
  const matchDisabledReason = row.status !== 1 || meaningfulIfScheduleTime(row.actualDepartureUtc) || meaningfulIfScheduleTime(row.actualArrivalUtc)
    ? "Only an unstarted scheduled IF flight can be matched" :
      !canEdit ? "Scheduling administrator access and an enabled IF connection are required" :
        managed && (managed.status !== "approved" || !["conflict", "reconciliation"].includes(managed.publishing_state ?? ""))
          ? "This IF schedule is already managed by its local flight" :
          marker && !managed ? "This IF schedule has an unknown local owner; review its reference first" : null;
  return {
    id: row.id, callsign: row.callsign, flightType: row.flightType, originIcao: row.originIcao, destinationIcao: row.destinationIcao,
    scheduledDepartureUtc: meaningfulIfScheduleTime(row.scheduledDepartureUtc), scheduledArrivalUtc: meaningfulIfScheduleTime(row.scheduledArrivalUtc),
    status: row.status, crew: row.crew.map(member => ({ userId: member.userId, role: member.role })),
    sequence: Number.isSafeInteger(row.sequence) ? row.sequence! : null, fingerprint: ifScheduleFingerprint(row),
    managedFlightId: managed?.id ?? null, editable: editDisabledReason === null, editDisabledReason,
    matchable: matchDisabledReason === null, matchDisabledReason,
  };
}
