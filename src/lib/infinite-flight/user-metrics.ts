import type { UnknownRecord } from "./types";

function getNestedValue(record: UnknownRecord, paths: string[][]) {
  for (const path of paths) {
    let current: unknown = record;

    for (const part of path) {
      if (!current || typeof current !== "object" || !(part in current)) {
        current = undefined;
        break;
      }

      current = (current as UnknownRecord)[part];
    }

    if (current !== undefined && current !== null) return current;
  }

  return null;
}

function normalizeInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const numberValue =
    typeof value === "number" ? value : Number(String(value).trim());

  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : null;
}

/** Reads a pilot's grade and violation count from an IF `/users` record. */
export function extractInfiniteFlightMetrics(user: UnknownRecord) {
  const grade = normalizeInteger(
    getNestedValue(user, [
      ["grade"],
      ["userGrade"],
      ["statistics", "grade"],
      ["stats", "grade"],
    ]),
  );

  const violationsValue = getNestedValue(user, [
    ["violations"],
    ["violationCount"],
    ["totalViolations"],
    ["statistics", "violations"],
    ["statistics", "violationCount"],
    ["stats", "violations"],
    ["stats", "violationCount"],
  ]);

  const violations = Array.isArray(violationsValue)
    ? violationsValue.length
    : normalizeInteger(violationsValue);

  return { grade, violations };
}
