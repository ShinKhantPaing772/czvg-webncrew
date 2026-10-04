import { LiveAircraft, ScheduledFlight } from "./types";
import { projectedOrigin } from "@/lib/scheduling/policy";

export const statusLabels = {
  pending: "Awaiting approval",
  approved: "Approved",
  in_progress: "In flight",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  needs_review: "Needs review",
};

export function formatUtc(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date)} UTC`;
}

export function utcInput(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

export function inputToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString();
  return iso.slice(0, 16) === value ? iso : null;
}

export function crewCount(flight: ScheduledFlight) {
  return 1 + flight.members.filter((member) => member.status === "approved").length;
}

export function departureForTime(aircraft: LiveAircraft | undefined, flights: ScheduledFlight[], departure: string, excludingId?: number) {
  if (!aircraft) return "";
  return projectedOrigin(
    aircraft.current_airport,
    flights.filter((flight) => flight.live_aircraft_id === aircraft.id),
    new Date(departure),
    excludingId,
  ) || "";
}

export function publishingLabel(value?: string | null) {
  const labels: Record<string, string> = {
    pending: "IF publishing pending", queued: "IF publishing pending", publishing: "Publishing to IF", processing: "Publishing to IF",
    published: "Published to IF", synced: "Published to IF", succeeded: "Published to IF",
    failed: "IF publishing failed", conflict: "IF schedule conflict", disabled: "IF publishing unavailable",
    reconcile: "IF reconciliation needed", reconciliation_required: "IF reconciliation needed", needs_reconciliation: "IF reconciliation needed",
    reconciliation: "IF reconciliation needed", partial: "IF crew update incomplete",
    not_required: "Local schedule", local: "Local schedule",
  };
  return value ? labels[value] || value.replace(/_/g, " ") : "Local schedule";
}

export function ifScheduleStatusLabel(status: number) {
  const labels: Record<number, string> = {
    0: "Unknown", 1: "Scheduled", 2: "Boarding", 3: "Boarded", 4: "Taxiing to runway",
    6: "In flight", 7: "Diverted", 8: "Delayed", 9: "Cancelled", 10: "Taxiing to parking", 11: "Arrived",
  };
  return labels[status] || "Unknown IF status";
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  return error instanceof Error ? error.message : fallback;
}
