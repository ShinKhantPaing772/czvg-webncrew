"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  FileText,
  Search,
  Home,
  PlaneTakeoff,
  Shield,
  FileStack,
  PlaneIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Header } from "./layout/header";
import { useSession } from "@/hooks/use-session";

interface CrewHeaderProps {
  children?: React.ReactNode;
}

export function CrewHeader({ children }: CrewHeaderProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const { user } = useSession();

  // Base navigation items (always visible)
  const baseNavItems = [
    { title: "Dashboard", href: "/crew/home", icon: Home },
    { title: "File PIREP", href: "/crew/file-pirep", icon: FileText },
    { title: "PIREPs", href: "/crew/view-pireps", icon: FileStack },
    { title: "Find Routes", href: "/crew/find-routes", icon: Search },
  ];

  // Admin permissions mapped to menu items
  const adminMenuMap: Record<string, any[]> = {
    home: [{ title: "Admin Dashboard", href: "/crew/admin", icon: Home }],
    pireps: [
      { title: "Manage PIREPs", href: "/crew/admin/pireps", icon: FileText },
    ],
    routes: [
      {
        title: "Manage Routes",
        href: "/crew/admin/routes",
        icon: PlaneTakeoff,
      },
    ],
    users: [{ title: "Manage Users", href: "/crew/admin/users", icon: Search }],
    aircrafts: [
      {
        title: "Manage Aircrafts",
        href: "/crew/admin/aircrafts",
        icon: PlaneIcon,
      },
    ],
    permissions: [
      {
        title: "Manage Permissions",
        href: "/crew/admin/permissions",
        icon: Shield,
      },
    ],
  };

  // Build admin navigation dynamically based on user permissions
  function getAdminNavItems() {
    if (!user?.Permissions) return [];

    const userPermissions = user.Permissions.map((p: any) => p.name);

    // Full admin access
    if (userPermissions.includes("admin")) {
      return Object.values(adminMenuMap).flat();
    }

    // Partial admin access based on permissions
    const allowed: any[] = [];

    userPermissions.forEach((perm: string) => {
      if (adminMenuMap[perm]) {
        allowed.push(...adminMenuMap[perm]);
      }
    });

    return allowed;
  }

  // Final navigation list: base + admin (when allowed)
  const navItems = [...baseNavItems, ...getAdminNavItems()];

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Desktop Sidebar */}
      <aside
        className={`fixed inset-y-0 z-20 hidden flex-col border-r bg-background transition-all duration-300 md:flex ${
          isSidebarOpen ? "w-64" : "w-16"
        }`}
      >
        <div className="flex h-16 items-center border-b px-4">
          {isSidebarOpen ? (
            <div className="flex items-center justify-between w-full">
              <h2 className="flex text-lg font-semibold">Crew Center</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="flex h-8 w-8"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="flex h-8 w-8"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
        </div>

        <nav className="flex-1 overflow-auto p-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <li
                  key={item.href}
                  className={`${isSidebarOpen ? "" : "items-center"}`}
                >
                  <a
                    href={item.href}
                    className={`flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
                      isActive
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : ""
                    }`}
                  >
                    <item.icon
                      className={`h-4 w-4 ${
                        isSidebarOpen ? "mr-2" : "mx-auto"
                      }`}
                    />
                    {isSidebarOpen && <span>{item.title}</span>}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="default"
            className="fixed bottom-4 left-4 z-50 h-11 rounded-md bg-primary px-4 text-primary-foreground shadow-lg md:hidden"
            aria-label="Open crew center sidebar"
          >
            <Menu className="h-4 w-4" />
            <span>Crew Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 gap-0 bg-white p-0">
          <div className="flex h-16 items-center border-b px-4">
            <SheetTitle className="text-lg font-semibold">
              Crew Center
            </SheetTitle>
          </div>

          <nav className="flex-1 overflow-auto p-2">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className={`flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
                        isActive
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : ""
                      }`}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "md:ml-16"
        }`}
      >
        <Header />
        <div className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</div>
      </main>
    </div>
  );
}
