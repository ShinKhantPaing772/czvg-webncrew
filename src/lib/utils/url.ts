/**
 * Utility functions for handling URLs in API routes
 */

/**
 * Creates an absolute URL from a relative path
 * Works in both development and production environments
 *
 * @param path - The relative path (e.g., '/api/auth/verify')
 * @returns The absolute URL
 */
export function getAbsoluteUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

  // Get the base URL from environment or construct it
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  // Ensure baseUrl doesn't end with a slash
  const normalizedBaseUrl = baseUrl.endsWith("/")
    ? baseUrl.slice(0, -1)
    : baseUrl;

  return `${normalizedBaseUrl}/${normalizedPath}`;
}
