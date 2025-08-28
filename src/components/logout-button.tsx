"use client";

import { Button } from "@/components/ui/button";
import { logout } from "@/lib/utils/auth";
import { useRouter } from "next/navigation";

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
  const router = useRouter();

  const handleLogout = async () => {
    // Clear authentication data from localStorage and revoke token in database
    await logout();

    // Redirect to login page
    router.push("/crew");
  };

  return (
    <Button onClick={handleLogout} variant="ghost" className={className}>
      Sign Out
    </Button>
  );
}
