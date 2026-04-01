"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getToken } from "@/lib/utils/auth";

type AuthGuardProps = {
  children: React.ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [permissions, setPermissions] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const token = getToken();

  async function checkSession() {
    try {
      if (!token) {
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
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }

  useEffect(() => {
    checkSession();
  }, [token]);

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

      if (!permissions.includes(adminSection)) {
        router.push("/crew/home");
      }
    }
  }, [isAuthenticated, pathname, permissions, router]);

  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
