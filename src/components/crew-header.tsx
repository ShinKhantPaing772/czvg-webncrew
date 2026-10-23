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
const brandMarkSrc = "/brand/czvg-logo-mark.png";

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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brandMarkSrc}
                  alt=""
                  className="size-6 object-contain"
                />
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
        <div className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-6 md:px-7 md:py-7">
          {children}
        </div>
      </div>
    </div>
  );
}
