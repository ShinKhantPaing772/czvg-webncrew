/**
 * External CDN Configuration & Resolver for CZVG Achievement Badges
 *
 * Allows badge SVG icons to be loaded directly via external HTTP(S) CDN
 * (e.g. jsDelivr / GitHub CDN or user-configured CDN / object storage),
 * consuming 0 bytes of MySQL database storage and 0 server bandwidth.
 */

export const DEFAULT_BADGE_CDN_BASE =
  "https://cdn.jsdelivr.net/gh/ShinKhantPaing772/czvg-webncrew@main/public/badges";

/**
 * Returns the external HTTPS CDN URL or resolved URL for a badge asset.
 *
 * @param pathOrFilename The filename or relative path (e.g. "badge-first-flight.svg", "/badges/badge-first-flight.svg")
 * @returns Fully qualified HTTPS CDN URL, or local path if configured to 'local'
 */
export function resolveBadgeImageUrl(pathOrFilename?: string | null): string {
  if (!pathOrFilename || typeof pathOrFilename !== "string") {
    return "";
  }
  const trimmed = pathOrFilename.trim();
  if (!trimmed) return "";

  // If already an absolute HTTP or HTTPS URL, return as-is
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Extract clean filename from path:
  // e.g. "/badges/badge-first-flight.svg" -> "badge-first-flight.svg"
  // "public/badges/badge-first-flight.svg" -> "badge-first-flight.svg"
  const filename = trimmed.replace(/^\/?(public\/)?(badges\/)?/, "");

  const cdnBase =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_BADGES_CDN_URL ||
        process.env.BADGES_CDN_URL)) ||
    DEFAULT_BADGE_CDN_BASE;

  if (cdnBase.trim().toLowerCase() === "local") {
    return `/badges/${filename}`;
  }

  return `${cdnBase.trim().replace(/\/+$/, "")}/${filename}`;
}

/**
 * Safe helper for UI components to get a displayable image URL.
 * Validates and converts relative paths or CDN URLs into displayable URLs.
 */
export function displayBadgeImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const resolved = resolveBadgeImageUrl(value);
  if (!resolved) return null;

  if (resolved.startsWith("/")) return resolved;

  try {
    const url = new URL(resolved);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
