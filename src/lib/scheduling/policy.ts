export class SchedulingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const RESERVED_STATUSES = ["approved", "in_progress"] as const;
export type Window = { scheduled_departure: Date | string | null; scheduled_arrival: Date | string | null };
export type QueueFlight = Window & { id: number; departure: string; arrival: string; status: string; queue_order?: number | null };

export function validId(value: unknown, label = "ID") {
  if (typeof value !== "string" && typeof value !== "number") throw new SchedulingError(`${label} must be a positive integer`);
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new SchedulingError(`${label} must be a positive integer`);
  return id;
}
export function airport(value: unknown, optional = false): string | null {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!normalized && optional) return null;
  if (!/^[A-Z0-9]{4}$/.test(normalized)) throw new SchedulingError("Airport ICAO must contain four letters or numbers");
  return normalized;
}
export function text(value: unknown, max: number, label: string): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new SchedulingError(`${label} is invalid`);
  const result = value.trim();
  if (result.length > max) throw new SchedulingError(`${label} must be at most ${max} characters`);
  return result || null;
}
export function scheduledWindow(start: unknown, end: unknown) {
  const missing = (value: unknown) => value == null || value === "";
  if (missing(start) && missing(end)) return { scheduled_departure: null, scheduled_arrival: null };
  if (missing(start) || missing(end)) throw new SchedulingError("Enter both schedule times, or leave both unspecified");
  const parse = (value: unknown) => {
    if (typeof value !== "string" || !/(Z|[+-]\d\d:\d\d)$/i.test(value)) throw new SchedulingError("Schedule times must include a UTC offset");
    const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i);
    if (!parts || Number(parts[2]) < 1 || Number(parts[2]) > 12 || Number(parts[3]) < 1 ||
        Number(parts[3]) > new Date(Date.UTC(Number(parts[1]), Number(parts[2]), 0)).getUTCDate() ||
        Number(parts[4]) > 23 || Number(parts[5]) > 59 || Number(parts[6] ?? 0) > 59) throw new SchedulingError("Invalid schedule time");
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1000 || date.getUTCFullYear() > 9999) throw new SchedulingError("Invalid schedule time");
    return date;
  };
  const scheduled_departure = parse(start), scheduled_arrival = parse(end);
  if (scheduled_arrival <= scheduled_departure) throw new SchedulingError("Arrival time must be after departure time");
  return { scheduled_departure, scheduled_arrival };
}
export function hasScheduledWindow(flight: Window): flight is { scheduled_departure: Date | string; scheduled_arrival: Date | string } {
  return flight.scheduled_departure != null && flight.scheduled_arrival != null;
}
export function overlaps(a: Window, b: Window) {
  if (!hasScheduledWindow(a) || !hasScheduledWindow(b)) return false;
  return +new Date(a.scheduled_departure) < +new Date(b.scheduled_arrival) && +new Date(b.scheduled_departure) < +new Date(a.scheduled_arrival);
}
export function orderedQueue<T extends QueueFlight>(flights: T[]) {
  return [...flights].sort((a, b) => (a.queue_order ?? Number.MAX_SAFE_INTEGER) - (b.queue_order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id);
}
export function projectedOrigin(currentAirport: string | null, flights: QueueFlight[], beforeQueueOrder?: number | null, excludeId?: number) {
  const before = orderedQueue(flights.filter(f => f.id !== excludeId && RESERVED_STATUSES.includes(f.status as "approved" | "in_progress") &&
    (beforeQueueOrder == null || (f.queue_order != null && f.queue_order < beforeQueueOrder))));
  return before.at(-1)?.arrival ?? currentAirport;
}
export function validateQueue(currentAirport: string | null, flights: QueueFlight[]) {
  const ordered = orderedQueue(flights);
  let origin = currentAirport;
  let previousTimedArrival: number | null = null;
  for (let index = 0; index < ordered.length; index++) {
    const flight = ordered[index];
    if (!Number.isSafeInteger(flight.queue_order) || flight.queue_order! <= 0 || (index && flight.queue_order === ordered[index - 1].queue_order)) {
      throw new SchedulingError("The aircraft's reserved queue position needs administrator repair", 409);
    }
    if (origin && flight.departure !== origin) throw new SchedulingError(`Flight ${flight.id} must depart from ${origin}`, 409);
    if ((flight.scheduled_departure == null) !== (flight.scheduled_arrival == null)) throw new SchedulingError("A flight must specify both times or neither", 409);
    if (hasScheduledWindow(flight)) {
      const departure = +new Date(flight.scheduled_departure), arrival = +new Date(flight.scheduled_arrival);
      if (!Number.isFinite(departure) || !Number.isFinite(arrival) || arrival <= departure) throw new SchedulingError("A flight has an invalid schedule interval", 409);
      if (previousTimedArrival != null && departure < previousTimedArrival) throw new SchedulingError("This aircraft already has an overlapping or later timed flight in its queue", 409);
      previousTimedArrival = arrival;
    }
    origin = flight.arrival;
  }
}
