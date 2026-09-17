"use client";

import { useCallback, useEffect, useState } from "react";
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

  const token = getToken();
  const isApplicantPortalUser = usesApplicantPortal(userStatus);

  const checkSession = useCallback(async () => {
    setIsAuthenticated(null);

    try {
      if (!token) {
        setPermissions([]);
        setUserStatus(null);
        setIsAuthenticated(false);
        return;
      }

      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const user = await res.json();

      if (res.ok) {
        setPermissions(
          user?.Permissions?.map((p: { name: string }) => p.name) || [],
        );
        setUserStatus(typeof user?.status === "number" ? user.status : null);
        setIsAuthenticated(true);
      } else {
        setUserStatus(null);
        setIsAuthenticated(false);
      }
    } catch {
      setUserStatus(null);
      setIsAuthenticated(false);
    }
  }, [token]);

  useEffect(() => {
    const handleFocus = () => {
      void checkSession();
    };

    void checkSession();
    window.addEventListener("focus", handleFocus);

    return () => window.removeEventListener("focus", handleFocus);
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
