"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  FileText,
  Search,
  Home,
  PlaneTakeoff,
  Shield,
  FileStack,
  PlaneIcon,
  Award,
  Medal,
  Trophy,
  Gauge,
  CalendarDays,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { clearSessionCache, useSession } from "@/hooks/use-session";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { clearApiCache } from "@/lib/utils/api";
import { logout } from "@/lib/utils/auth";

interface CrewHeaderProps {
  children?: React.ReactNode;
}

const brandLogoSrc = "/brand/czvg-logo-horizontal.png";

/**
 * Official China Southern Airlines Tailfin + Kapok Emblem (extracted from `/public/airlines/china-southern.svg`)
 * Used when the sidebar is collapsed so the authentic emblem remains visible.
 */
function ChinaSouthernTailfinMark({ className = "h-5 w-auto" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 128.2"
      aria-hidden="true"
      className={className}
    >
      <polygon fill="#0093D0" points="0,128.1 128.2,128.1 179.6,0 128.2,0" />
      <path
        fill="#FFFFFF"
        d="M119.5,49.3c-2-1-3.3-3-3.3-5.3c0-3.2,2.6-5.9,5.9-5.9c3.2,0,5.9,2.6,5.9,5.9c0,2.3-1.4,4.4-3.4,5.3V51c1.8,0.2,4,0.9,5.4,1.6c0.6-0.1,1.4-0.1,2.2-0.1c7.4,0,12.6,4.9,12.6,11.6c0,4.2-3.7,8-7.9,8c-4.2,0-8-4.1-7.2-8.3c0,0-0.4,1.4-0.4,3.2c0,1.1,0,21.2,0,21.2c-0.2,2.4-3.4,15.7-18.4,15.7S92.7,90.6,92.5,88.2c0,0,0-20.1,0-21.2c0-1.7-0.5-3.2-0.5-3.2c0.8,4-3.1,8.3-7.2,8.3c-4.2,0-7.9-3.8-7.9-8c0-6.7,5.2-11.6,12.6-11.6c0.8,0,1.6,0,2.2,0.1c1.3-0.7,3.6-1.5,5.4-1.6v-1.7c-2-1-3.3-3-3.3-5.3c0-3.2,2.6-5.9,5.9-5.9c3.3,0,5.9,2.6,5.9,5.9c0,2.3-1.4,4.4-3.4,5.3v2.2c0.5,0.2,1,0.3,1.5,0.6c0.9-2,2.7-3.5,4.8-4.2v-1.8c-2-0.9-3.4-3-3.4-5.3c0-3.2,2.6-5.9,5.9-5.9c3.2,0,5.9,2.6,5.9,5.9c0,2.3-1.4,4.4-3.3,5.3v1.8c2.1,0.7,3.9,2.2,4.8,4.2c0.5-0.2,1-0.4,1.5-0.6L119.5,49.3z"
      />
      <path
        fill="#ED1B2F"
        d="M142.3,64.2c0-5.5-3.7-9.9-11.4-9.9c-5.1,0-11.1,4.3-11.1,15.2c0,8.5,0,16.2,0,16.2c2.2-1.5,5.3-2.8,6.9-2.8c0-4.8,0-14.3,0-15.1c0-5.8,4.2-7.5,6.1-7.5c-1.1,1-1.8,2.2-1.8,3.9c0,3.1,2.5,5.6,5.6,5.6C139.8,69.8,142.2,67.5,142.3,64.2z M79,64.2c0-5.5,3.7-9.9,11.4-9.9c5.1,0,11.2,4.3,11.2,15.2c0,8.5,0,16.2,0,16.2c-2.2-1.5-5.3-2.8-6.9-2.8c0-4.8,0-14.3,0-15.1c0-5.8-4.2-7.5-6.1-7.5c1.1,1,1.8,2.2,1.8,3.9c0,3.1-2.6,5.6-5.6,5.6C81.5,69.8,79.1,67.5,79,64.2z M110.7,101.6c12.8,0,15.7-10.7,16.1-13.5c0,0,0-3,0-3.6c-4,1-7.5,3.1-9.9,6.3c-0.8-3.7-3.2-6.8-6.2-8.9c-3,2-5.3,5.2-6.2,8.9c-2.4-3.2-5.9-5.3-9.9-6.3c0,0.6,0,3.6,0,3.6C94.9,90.9,97.8,101.6,110.7,101.6z M111.6,44.9v4.5c2.2,0.3,4.1,1.8,4.8,3.6c-2.6,1.7-4.7,4.3-5.7,7.5c-1-3.2-3.1-5.8-5.7-7.5c0.8-1.8,2.6-3.3,4.8-3.6v-4.5c-1.8-0.4-3.2-2.1-3.2-4c0-2.3,1.9-4.1,4.1-4.1c2.3,0,4.1,1.8,4.1,4.1C114.8,42.8,113.4,44.5,111.6,44.9z M100.3,48.1v4.7c5.6,1.1,9.6,7,9.6,12.5c0,5.8,0,15.2,0,15.2c-2.6,1.5-5.2,4.6-6,7.1c-0.2-0.2-0.4-0.5-0.7-0.7c0,0,0-11.1,0-19.6c0-5.9-3.2-11.9-8.8-13.8c0,0,1.8-0.8,4.1-0.8V48c-1.8-0.4-3.2-2-3.2-4c0-2.3,1.8-4.1,4.1-4.1s4.1,1.8,4.1,4.1C103.5,46,102.1,47.6,100.3,48.1z M122.9,48.1v4.6c2.3,0,4.1,0.8,4.1,0.8c-5.7,2-8.8,8-8.8,13.8c0,8.5,0,19.6,0,19.6c-0.3,0.3-0.5,0.5-0.7,0.7c-0.8-2.6-3.4-5.7-6-7.1c0,0,0-9.4,0-15.2c0-5.5,4-11.4,9.6-12.5V48c-1.8-0.4-3.2-2-3.2-4c0-2.3,1.8-4.1,4.1-4.1s4.1,1.8,4.1,4.1C126.2,46,124.8,47.7,122.9,48.1z"
      />
    </svg>
  );
}
// Persist sidebar state across client-side route transitions
let persistedSidebarOpen = true;
let persistedAdminExpanded: boolean | null = null;

export function CrewHeader({ children }: CrewHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => persistedSidebarOpen,
  );
  const [isAdminExpanded, setIsAdminExpanded] = useState(() =>
    persistedAdminExpanded !== null
      ? persistedAdminExpanded
      : pathname
        ? pathname.startsWith("/crew/admin")
        : false,
  );
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { user } = useSession();
  const { t } = useI18n();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const toggleSidebar = (next: boolean) => {
    persistedSidebarOpen = next;
    setIsSidebarOpen(next);
  };

  const toggleAdminExpanded = () => {
    setIsAdminExpanded((prev) => {
      const next = !prev;
      persistedAdminExpanded = next;
      return next;
    });
  };

  const baseNavItems = [
    { title: t("Dashboard", "飞行员主页"), href: "/crew/home", icon: Home },
    {
      title: t("File PIREP", "提交飞行报告"),
      href: "/crew/file-pirep",
      icon: FileText,
    },
    {
      title: t("PIREPs", "飞行报告"),
      href: "/crew/view-pireps",
      icon: FileStack,
    },
    {
      title: t("Find Routes", "航线查询"),
      href: "/crew/find-routes",
      icon: Search,
    },
    ...(user?.canAccessLiveScheduling
      ? [
          {
            title: t("Live Scheduling", "实时排班"),
            href: "/crew/scheduling",
            icon: CalendarDays,
          },
        ]
      : []),
  ];

  const adminMenuMap: Record<string, any[]> = {
    home: [
      {
        title: t("Admin Dashboard", "管理概览"),
        href: "/crew/admin",
        icon: Home,
      },
    ],
    pireps: [
      {
        title: t("Manage PIREPs", "管理飞行报告"),
        href: "/crew/admin/pireps",
        icon: FileText,
      },
      {
        title: t("Manage Multipliers", "管理倍率代码"),
        href: "/crew/admin/multipliers",
        icon: Gauge,
      },
    ],
    routes: [
      {
        title: t("Manage Routes", "管理航线"),
        href: "/crew/admin/routes",
        icon: PlaneTakeoff,
      },
    ],
    users: [
      {
        title: t("Manage Users", "管理飞行员"),
        href: "/crew/admin/users",
        icon: Search,
      },
    ],
    aircrafts: [
      {
        title: t("Manage Aircrafts", "管理机队"),
        href: "/crew/admin/aircrafts",
        icon: PlaneIcon,
      },
    ],
    ranks: [
      {
        title: t("Manage Ranks", "管理职级"),
        href: "/crew/admin/ranks",
        icon: Medal,
      },
    ],
    scheduling: [
      {
        title: t("Manage Live Scheduling", "管理实时排班"),
        href: "/crew/admin/scheduling",
        icon: CalendarDays,
      },
    ],
    awards: [
      {
        title: t("Manage Awards", "管理勋章"),
        href: "/crew/admin/awards",
        icon: Trophy,
      },
      {
        title: t("Pilot Awards", "授予勋章"),
        href: "/crew/admin/pilot-awards",
        icon: Award,
      },
    ],
    permissions: [
      {
        title: t("Manage Permissions", "管理权限"),
        href: "/crew/admin/permissions",
        icon: Shield,
      },
    ],
  };

  function getAdminNavItems() {
    if (!user?.Permissions) return [];
    const userPermissions = user.Permissions.map((p: any) => p.name);
    if (userPermissions.includes("admin")) {
      return Object.values(adminMenuMap).flat();
    }
    const allowed: any[] = [];
    userPermissions.forEach((perm: string) => {
      if (adminMenuMap[perm]) {
        allowed.push(...adminMenuMap[perm]);
      }
    });
    return allowed;
  }

  const adminNavItems = getAdminNavItems();
  const navItems = [...baseNavItems, ...adminNavItems];
  const showAdminItems = isAdminExpanded || pathname?.startsWith("/crew/admin");

  const handleLogout = () => {
    setIsLoggingOut(true);
    clearSessionCache();
    clearApiCache();
    logout();
    router.push("/crew");
  };

  return (
    <div className="flex min-h-screen bg-[var(--v2-background-bg-deep,#f2f6fb)] text-[var(--v2-text-text-base,#0f172a)] font-sans select-none [&_input]:select-text [&_textarea]:select-text">
      {/* Left Sidebar — Pinned to viewport top (`sticky top-0 h-screen`) */}
      <aside
        style={{ width: isSidebarOpen ? 216 : 52 }}
        className="sticky top-0 hidden h-screen shrink-0 flex-col justify-between overflow-y-auto py-2.5 pl-2.5 pr-1 transition-[width] duration-150 ease-out md:flex"
      >
        <div className="flex flex-col gap-3">
          {/* Top Brand Row — Authentic Repository Brand Assets */}
          <div className="flex h-9 items-center justify-between px-1.5">
            {isSidebarOpen ? (
              <>
                <Link
                  href="/"
                  title="Back to Public Website"
                  className="flex min-w-0 items-center gap-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={brandLogoSrc}
                    alt="China Southern Virtual Group"
                    className="h-7 w-auto max-w-[156px] shrink-0 object-contain"
                  />
                </Link>
                <button
                  type="button"
                  onClick={() => toggleSidebar(false)}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                  className="flex size-8 shrink-0 items-center justify-center rounded-[6px] text-[var(--v2-icon-icon-muted,#64748b)] hover:bg-[#0052a5]/[0.06] hover:text-[#0052a5]"
                >
                  <PanelLeftClose className="size-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => toggleSidebar(true)}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="mx-auto flex size-8 items-center justify-center rounded-[6px] hover:bg-[#0052a5]/[0.06]"
              >
                <ChinaSouthernTailfinMark className="h-5 w-auto" />
              </button>
            )}
          </div>

          {/* Navigation Items — Instant client-side `<Link prefetch>` */}
          <nav aria-label="Crew Center navigation" className="space-y-3">
            <ul className="flex flex-col gap-0.5">
              {baseNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch
                      title={!isSidebarOpen ? item.title : undefined}
                      className={`flex h-8 items-center gap-2 rounded-[6px] px-2.5 text-[13px] font-medium transition-colors duration-100 ${
                        isActive
                          ? "bg-[#0052a5]/[0.10] text-[#0052a5]"
                          : "text-[var(--v2-text-text-muted,#475569)] hover:bg-[#0052a5]/[0.05] hover:text-[#003a74]"
                      }`}
                    >
                      <item.icon
                        className={`size-3.5 shrink-0 ${
                          isActive
                            ? "text-[#0052a5]"
                            : "text-[var(--v2-icon-icon-muted,#64748b)]"
                        } ${!isSidebarOpen ? "mx-auto" : ""}`}
                      />
                      {isSidebarOpen && (
                        <span className="truncate">{item.title}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Collapsible Staff Console — Unified `h-8` rows */}
            {adminNavItems.length > 0 && (
              <div>
                {isSidebarOpen && (
                  <button
                    type="button"
                    onClick={toggleAdminExpanded}
                    className="flex h-8 w-full items-center justify-between rounded-[6px] px-2.5 text-[13px] font-medium text-[var(--v2-text-text-faint,#64748b)] hover:bg-[#0052a5]/[0.05] hover:text-[#003a74] transition-colors"
                  >
                    <span>{t("Staff Console", "管理后台")}</span>
                    {showAdminItems ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </button>
                )}

                {(showAdminItems || !isSidebarOpen) && (
                  <ul className="mt-0.5 flex flex-col gap-0.5">
                    {adminNavItems.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            prefetch
                            title={!isSidebarOpen ? item.title : undefined}
                            className={`flex h-8 items-center gap-2 rounded-[6px] px-2.5 text-[13px] font-medium transition-colors duration-100 ${
                              isActive
                                ? "bg-[#0052a5]/[0.10] text-[#0052a5]"
                                : "text-[var(--v2-text-text-muted,#475569)] hover:bg-[#0052a5]/[0.05] hover:text-[#003a74]"
                            }`}
                          >
                            <item.icon
                              className={`size-3.5 shrink-0 ${
                                isActive
                                  ? "text-[#0052a5]"
                                  : "text-[var(--v2-icon-icon-muted,#64748b)]"
                              } ${!isSidebarOpen ? "mx-auto" : ""}`}
                            />
                            {isSidebarOpen && (
                              <span className="truncate">{item.title}</span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* Bottom Controls: Language Switcher + User Row — Unified `h-8` benchmark */}
        {isSidebarOpen ? (
          <div className="flex flex-col gap-0.5">
            <LanguageSwitcher className="w-full justify-start" />
            <div className="flex h-8 items-center justify-between gap-2 rounded-[6px] px-2.5">
              <span className="truncate text-[13px] font-medium text-[var(--v2-text-text-muted,#475569)]">
                {user?.name || "CZVG Pilot"}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                title={t("Sign out", "退出登录")}
                aria-label={t("Sign out", "退出登录")}
                className="flex size-8 shrink-0 items-center justify-center rounded-[6px] text-[var(--v2-icon-icon-muted,#64748b)] hover:bg-[#0052a5]/[0.06] hover:text-[#0052a5]"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <LanguageSwitcher compact className="size-8 p-0" />
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              title={t("Sign out", "退出登录")}
              aria-label={t("Sign out", "退出登录")}
              className="mx-auto flex size-8 items-center justify-center rounded-[6px] text-[var(--v2-icon-icon-muted,#64748b)] hover:bg-[#0052a5]/[0.06] hover:text-[#0052a5]"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Drawer */}
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            className="fixed bottom-4 left-4 z-50 flex h-8 items-center gap-2 rounded-[6px] bg-[#0052a5] px-2.5 text-[13px] font-medium text-white shadow-[var(--v2-elevation-floating)] md:hidden"
            aria-label="Open crew center sidebar"
          >
            <Menu className="size-3.5" />
            <span>{t("Menu", "菜单")}</span>
          </button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-60 gap-0 border-0 bg-[#f2f6fb] p-3"
        >
          <div className="mb-3 flex h-9 items-center justify-between gap-2 px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandLogoSrc}
              alt="China Southern Virtual Group"
              className="h-7 w-auto max-w-[140px] object-contain"
            />
            <LanguageSwitcher compact className="size-8 p-0" />
            <SheetTitle className="sr-only">CZVG Crew</SheetTitle>
          </div>
          <nav aria-label="Mobile Crew Center navigation">
            <ul className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch
                      className={`flex h-8 items-center gap-2 rounded-[6px] px-2.5 text-[13px] font-medium transition-colors ${
                        isActive
                          ? "bg-[#0052a5]/[0.10] text-[#0052a5]"
                          : "text-[var(--v2-text-text-muted,#475569)] hover:bg-[#0052a5]/[0.05] hover:text-[#003a74]"
                      }`}
                    >
                      <item.icon className="size-3.5 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>

      {/* Main Panel */}
      <div
        data-slot="home-panel"
        className="m-1.5 md:m-2 flex min-h-[calc(100vh-16px)] min-w-0 flex-1 flex-col rounded-[10px] bg-[var(--v2-background-bg-base,#ffffff)] shadow-[var(--v2-elevation-raised)]"
      >
        <div className="mx-auto w-full max-w-[980px] flex-1 px-6 py-8 md:px-10 md:py-10">
          {children}
        </div>
      </div>
    </div>
  );
}
