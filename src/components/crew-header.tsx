"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Menu,
  FileText,
  Search,
  Home,
  LogOut,
  PlaneTakeoff,
  Shield,
  FileStack,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Header } from "./layout/header";

interface CrewHeaderProps {
  userName: string;
  userAvatar?: string;
  isAdmin?: boolean;
  children?: React.ReactNode;
}

export function CrewHeader({
  userName,
  userAvatar,
  isAdmin = false,
  children,
}: CrewHeaderProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const baseNavItems = [
    {
      title: "Dashboard",
      href: "/crew/home",
      icon: Home,
    },
    {
      title: "File PIREP",
      href: "/crew/file-pirep",
      icon: FileText,
    },
    {
      title: "PIREPs",
      href: "/crew/view-pireps",
      icon: FileStack,
    },
    {
      title: "Find Routes",
      href: "/crew/find-routes",
      icon: Search,
    },
  ];

  const adminNavItems = [
    {
      title: "Dashboard",
      href: "/crew/home",
      icon: Home,
    },
    {
      title: "File PIREP",
      href: "/crew/file-pirep",
      icon: FileText,
    },
    {
      title: "PIREPs",
      href: "/crew/view-pireps",
      icon: FileText,
    },
    {
      title: "Find Routes",
      href: "/crew/find-routes",
      icon: Search,
    },
    {
      title: "Admin Dashboard",
      href: "/crew/admin",
      icon: Home,
    },
    {
      title: "Manage PIREPs",
      href: "/crew/admin/pireps",
      icon: FileText,
    },
    {
      title: "Manage Routes",
      href: "/crew/admin/routes",
      icon: PlaneTakeoff,
    },
    {
      title: "Manage Users",
      href: "/crew/admin/users",
      icon: Search,
    },
    {
      title: "Manage Permissions",
      href: "/crew/admin/permissions",
      icon: Shield,
    },
  ];

  const navItems = isAdmin ? adminNavItems : baseNavItems;

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
            <h2 className="text-lg font-semibold">Crew Center</h2>
          ) : (
            <span className="mx-auto font-bold">CC</span>
          )}
        </div>

        <nav className="flex-1 overflow-auto p-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <li
                  key={item.href}
                  className={` ${isSidebarOpen ? "" : "items-center"}`}
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

        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            {isSidebarOpen && (
              <>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={userAvatar} alt={userName} />
                  <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
                </Avatar>

                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium">{userName}</p>
                </div>
              </>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="ml-auto h-8 w-8"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed left-4 bottom-4 z-50 md:hidden"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <p className="fixed left-16 bottom-4 z-50 md:hidden">
          For Crew Center Sidebar
        </p>
        <SheetContent side="left" className="w-64 p-0 bg-white">
          <div className="flex h-16 items-center border-b px-4">
            <h2 className="text-lg font-semibold">Crew Center</h2>
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

          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={userAvatar} alt={userName} />
                <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
              </Avatar>

              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium">{userName}</p>
              </div>
            </div>
          </div>
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
