import { InfiniteFlightApiError } from "./types";
import type { UnknownRecord } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeInfiniteFlightId(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isInfiniteFlightId(value: unknown) {
  return UUID_PATTERN.test(normalizeInfiniteFlightId(value));
}

export function findInfiniteFlightUser(users: unknown, username: unknown) {
  if (!Array.isArray(users) || typeof username !== "string") return null;
  const normalizedUsername = username.trim().toLocaleLowerCase("en-US");
  if (!normalizedUsername) return null;

  return (
    users.find((item): item is UnknownRecord => {
      if (!item || typeof item !== "object") return false;
      const record = item as UnknownRecord;
      const discourseUsername =
        typeof record.discourseUsername === "string"
          ? record.discourseUsername.trim().toLocaleLowerCase("en-US")
          : "";
      const perUserErrorCode = Number(record.errorCode ?? 0);

      return (
        discourseUsername === normalizedUsername &&
        perUserErrorCode === 0 &&
        isInfiniteFlightId(record.userId)
      );
    }) ?? null
  );
}

export function requireInfiniteFlightId(value: unknown, label: string) {
  const id = normalizeInfiniteFlightId(value);
  if (!isInfiniteFlightId(id)) {
    throw new InfiniteFlightApiError(`${label} must be a valid UUID`, 400);
  }
  return id;
}
