"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getToken } from "@/lib/utils/auth";

type AuthGuardProps = {
  children: React.ReactNode;
};

type User = {
  callsign: string;
  id: string;
  name: string;
  email: string;
  rank: string;
  flightTime: string;
  pirepsFiled: number;
  joined: string;
  status: number;
  Permissions: Array<{
    userid: string;
    name: string;
  }>;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const token = getToken(); // from localStorage or cookie

  async function checkSession() {
    try {
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: token }),
      });
      const user = await res.json();
      setIsAdmin(
        Boolean(
          user?.Permissions?.some(
            (permission: { name: string }) => permission.name === "admin"
          )
        )
      );
      if (res.ok) {
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
  }, []);

  useEffect(() => {
    if (isAuthenticated === null) return; // wait for check

    const isLoginorForgetPasswordPage =
      pathname === "/crew" || pathname === "/crew/forgot-password";
    const isAdminPage = pathname?.startsWith("/crew/admin");

    if (
      !isAuthenticated &&
      pathname?.startsWith("/crew") &&
      !isLoginorForgetPasswordPage
    ) {
      router.push("/crew"); // force to login
    }

    if (isAuthenticated && isLoginorForgetPasswordPage) {
      router.push("/crew/home"); // logged-in users skip login
    }

    if (isAuthenticated && isAdminPage && !isAdmin) {
      router.push("/crew/home");
    }
  }, [isAuthenticated, pathname, router, isAdmin]);

  // ⬇️ Show loading screen while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        {/* Replace with spinner/skeleton if you like */}
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
