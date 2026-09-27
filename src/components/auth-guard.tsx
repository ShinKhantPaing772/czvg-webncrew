"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  getCrewLandingPath,
  usesApplicantPortal,
} from "@/lib/pilot-status";
import { getToken } from "@/lib/utils/auth";

type AuthGuardProps = {
  children: React.ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [permissions, setPermissions] = useState<string[]>([]);
  const [userStatus, setUserStatus] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const verifiedToken = useRef<string | null>(null);
  const pendingCheck = useRef<{
    token: string;
    controller: AbortController;
  } | null>(null);

  const isApplicantPortalUser = usesApplicantPortal(userStatus);

  const checkSession = useCallback(async function verifySession(background = false): Promise<void> {
    // Another tab may have replaced or removed the token since our last render.
    const currentToken = getToken();
    if (pendingCheck.current?.token === currentToken) return;

    pendingCheck.current?.controller.abort();
    pendingCheck.current = null;

    // A focus check must not unmount a verified page and discard its form state.
    // Initial checks, navigation and account changes still use the loading view.
    const keepCurrentPage = background && verifiedToken.current === currentToken;
    if (!keepCurrentPage) {
      verifiedToken.current = null;
      setIsAuthenticated(null);
    }

    const invalidateSession = () => {
      verifiedToken.current = null;
      setPermissions([]);
      setUserStatus(null);
      setIsAuthenticated(false);
    };

    if (!currentToken) {
      invalidateSession();
      return;
    }

    const request = { token: currentToken, controller: new AbortController() };
    pendingCheck.current = request;
    const isCurrentRequest = () =>
      pendingCheck.current === request &&
      !request.controller.signal.aborted &&
      getToken() === currentToken;

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: currentToken }),
        signal: request.controller.signal,
      });

      if (!isCurrentRequest()) return;

      if (!res.ok) {
        // Temporary outages do not invalidate an already verified session.
        // The API remains authoritative for each protected operation.
        if (!keepCurrentPage || [400, 401, 403, 404].includes(res.status)) {
          invalidateSession();
        }
        return;
      }

      const user = await res.json();
      if (!isCurrentRequest()) return;

      verifiedToken.current = currentToken;
      setPermissions(
        user?.Permissions?.map((p: { name: string }) => p.name) || [],
      );
      setUserStatus(typeof user?.status === "number" ? user.status : null);
      setIsAuthenticated(true);
    } catch {
      if (isCurrentRequest() && !keepCurrentPage) invalidateSession();
    } finally {
      if (pendingCheck.current === request) {
        pendingCheck.current = null;
        // A cross-tab login/logout may finish while verification is pending,
        // without another focus event to start checking the new session.
        if (!request.controller.signal.aborted && getToken() !== currentToken) {
          void verifySession();
        }
      }
    }
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      void checkSession(true);
    };

    void checkSession();
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      pendingCheck.current?.controller.abort();
      pendingCheck.current = null;
    };
  }, [checkSession, pathname]);

  useEffect(() => {
    if (isAuthenticated === null) return;

    const isLoginPage =
      pathname === "/crew" || pathname === "/crew/forgot-password";

    const isAdminPage = pathname.startsWith("/crew/admin");

    // Not authenticated → must login
    if (!isAuthenticated && pathname.startsWith("/crew") && !isLoginPage) {
      router.push("/crew");
      return;
    }

    // Authenticated user visiting login page
    if (isAuthenticated && isLoginPage) {
      router.push(getCrewLandingPath(userStatus));
      return;
    }

    if (
      isAuthenticated &&
      isApplicantPortalUser &&
      pathname.startsWith("/crew") &&
      pathname !== "/crew/application"
    ) {
      router.push("/crew/application");
      return;
    }

    if (isAuthenticated && userStatus === 1 && pathname === "/crew/application") {
      router.push("/crew/home");
      return;
    }

    // Admin pages
    if (isAuthenticated && isAdminPage) {
      // 1. If user has admin → full access
      if (permissions.includes("admin")) return;

      const parts = pathname.split("/").filter(Boolean);

      // If visiting /crew/admin
      if (parts.length === 2) {
        // Require "home" permission for admin landing page
        if (!permissions.includes("home")) {
          router.push("/crew/home");
        }
        return;
      }

      // Visiting /crew/admin/{section}
      const adminSection = parts[2];
      const requiredPermission =
        adminSection === "multipliers" ? "pireps" : adminSection;

      if (!permissions.includes(requiredPermission)) {
        router.push("/crew/home");
      }
    }
  }, [
    isApplicantPortalUser,
    isAuthenticated,
    pathname,
    permissions,
    router,
    userStatus,
  ]);

  const isRedirectingToApplicantPortal =
    isAuthenticated &&
    isApplicantPortalUser &&
    pathname.startsWith("/crew") &&
    pathname !== "/crew/application";

  if (isAuthenticated === null || isRedirectingToApplicantPortal) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
