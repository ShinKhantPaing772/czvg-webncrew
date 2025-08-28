"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isAuthenticated } from "@/lib/utils/auth";

type AuthGuardProps = {
  children: React.ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if user is authenticated
    const authenticated = isAuthenticated();
    const isLoginPage = pathname === "/crew";

    // If not authenticated and not on login page, redirect to login
    if (!authenticated && pathname?.startsWith("/crew") && !isLoginPage) {
      router.push("/crew");
    }

    // If authenticated and on login page, redirect to home
    if (authenticated && isLoginPage) {
      router.push("/crew/home");
    }
  }, [pathname, router]);

  return <>{children}</>;
}
