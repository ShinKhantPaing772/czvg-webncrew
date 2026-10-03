export class SchedulingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const RESERVED_STATUSES = ["approved", "in_progress"] as const;
export type Window = { scheduled_departure: Date | string; scheduled_arrival: Date | string };
export type QueueFlight = Window & { id: number; departure: string; arrival: string; status: string };

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
  const parse = (value: unknown) => {
    if (typeof value !== "string" || !/(Z|[+-]\d\d:\d\d)$/i.test(value)) throw new SchedulingError("Schedule times must include a UTC offset");
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new SchedulingError("Invalid schedule time");
    return date;
  };
  const scheduled_departure = parse(start), scheduled_arrival = parse(end);
  if (scheduled_arrival <= scheduled_departure) throw new SchedulingError("Arrival time must be after departure time");
  return { scheduled_departure, scheduled_arrival };
}
export function overlaps(a: Window, b: Window) {
  return +new Date(a.scheduled_departure) < +new Date(b.scheduled_arrival) && +new Date(b.scheduled_departure) < +new Date(a.scheduled_arrival);
}
export function orderedQueue<T extends QueueFlight>(flights: T[]) {
  return [...flights].sort((a, b) => +new Date(a.scheduled_departure) - +new Date(b.scheduled_departure) || a.id - b.id);
}
export function projectedOrigin(currentAirport: string | null, flights: QueueFlight[], departure: Date, excludeId?: number) {
  const before = orderedQueue(flights.filter(f => f.id !== excludeId && RESERVED_STATUSES.includes(f.status as "approved" | "in_progress") && +new Date(f.scheduled_departure) < +departure));
  return before.at(-1)?.arrival ?? currentAirport;
}
export function validateQueue(currentAirport: string | null, flights: QueueFlight[]) {
  const ordered = orderedQueue(flights);
  let origin = currentAirport;
  for (let index = 0; index < ordered.length; index++) {
    const flight = ordered[index];
    if (origin && flight.departure !== origin) throw new SchedulingError(`Flight ${flight.id} must depart from ${origin}`, 409);
    if (index && overlaps(ordered[index - 1], flight)) throw new SchedulingError("This aircraft already has an overlapping flight", 409);
    origin = flight.arrival;
  }
}
