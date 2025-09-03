"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { verifyToken } from "@/lib/utils/token";
import { getToken } from "@/lib/utils/auth";

type AuthGuardProps = {
  children: React.ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const token = getToken();
  // Check if user is authenticated
  const isAuthenticated = verifyToken(token || "");

  useEffect(() => {
    const isLoginPage = pathname === "/crew";

    // If not authenticated and not on login page, redirect to login
    if (!isAuthenticated && pathname?.startsWith("/crew") && !isLoginPage) {
      router.push("/crew");
    }

    // If authenticated and on login page, redirect to home
    if (isLoginPage) {
      router.push("/crew/home");
    }
  }, [pathname, router]);

  return <>{children}</>;
}
