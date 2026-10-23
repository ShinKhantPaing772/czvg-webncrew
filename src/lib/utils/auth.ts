"use client";

// Constants
const TOKEN_KEY = "auth_token";

/**
 * Store authentication token in localStorage
 */
export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

/**
 * Get authentication token from localStorage
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored) return stored;

  // Local preview mode: auto-issue a fixture token so crew pages load without DB login.
  if (process.env.NEXT_PUBLIC_CREW_PREVIEW === "1") {
    const previewToken = "preview-token";
    localStorage.setItem(TOKEN_KEY, previewToken);
    return previewToken;
  }

  return null;
}

/**
 * Remove authentication token from localStorage
 */
export function removeToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Clear all authentication data and revoke token in database
 */
export async function logout(): Promise<void> {
  const token = getToken();

  // Clear local storage data
  removeToken();

  // Revoke token in database if available
  if (token) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    } catch (error) {
      console.error("Error revoking token:", error);
    }
  }
}
