/** .NET's default date is missing information, not a January flight in year one. */
export function meaningfulIfScheduleTime(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const time = new Date(value);
  return Number.isFinite(time.getTime()) && time.getUTCFullYear() > 1 ? time.toISOString() : null;
}

export function ifScheduleTimeMs(value: Date | string | null | undefined): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) && value.getUTCFullYear() > 1 ? value.getTime() : null;
  const normalized = meaningfulIfScheduleTime(value);
  return normalized ? Date.parse(normalized) : null;
}

export function isUnsetIfScheduleTime(value: unknown): boolean {
  return value == null || (typeof value === "string" && /^0001-01-01T00:00:00(?:\.0{1,9})?(?:Z|[+-]00:00)?$/i.test(value));
}
