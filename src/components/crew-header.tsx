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
import { NotificationBell } from "@/components/notification-bell";
import { usePilotNotifications } from "@/hooks/use-pilot-notifications";
import { clearSessionCache, useSession } from "@/hooks/use-session";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { clearApiCache } from "@/lib/utils/api";
import { logout } from "@/lib/utils/auth";

interface CrewHeaderProps {
  children?: React.ReactNode;
}

const brandLogoSrc = "/brand/czvg-logo-horizontal.png";
const brandLogoWhiteSrc = "/brand/czvg-logo-horizontal-white.png";
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
  // One inbox for every bell below (desktop sidebar and mobile button).
  const inbox = usePilotNotifications(user?.id);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Keep Staff Console collapsed on pilot pages so the sidebar stays short.
  useEffect(() => {
    if (pathname && !pathname.startsWith("/crew/admin")) {
      persistedAdminExpanded = false;
      setIsAdminExpanded(false);
    }
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
    <div className="flex min-h-screen flex-col bg-[var(--v2-background-bg-deep,#f3f4f6)] text-[var(--v2-text-text-base,#171717)] font-sans select-none md:flex-row [&_input]:select-text [&_textarea]:select-text">
      {/* Left Sidebar — Pinned to viewport top (`sticky top-0 h-screen`) */}
      <aside
        style={{ width: isSidebarOpen ? 248 : 56 }}
        className="sticky top-0 hidden h-screen shrink-0 flex-col justify-between overflow-y-auto py-3 pl-3 pr-1 transition-[width] duration-150 ease-out md:flex"
      >
        <div className="flex flex-col gap-4">
          {/* Top Brand Row — Authentic Repository Brand Assets */}
          <div className="flex h-9 items-center justify-between px-1">
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
                    className="brand-logo-light h-7 w-auto max-w-[156px] shrink-0 object-contain"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={brandLogoWhiteSrc}
                    alt="China Southern Virtual Group"
                    className="brand-logo-dark h-7 w-auto max-w-[156px] shrink-0 object-contain"
                  />
                </Link>
                <button
                  type="button"
                  onClick={() => toggleSidebar(false)}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                  className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--v2-icon-icon-muted,#737373)] transition-colors duration-150 hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--v2-text-text-base,#171717)]"
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
                className="mx-auto flex size-8 items-center justify-center rounded-[8px] transition-colors duration-150 hover:bg-[rgba(0,0,0,0.04)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brandMarkSrc}
                  alt=""
                  className="brand-logo-mark size-6 object-contain"
                />
              </button>
            )}
          </div>

          {/* Navigation Items — Instant client-side `<Link prefetch>` */}
          <nav aria-label="Crew Center navigation" className="space-y-6">
            <ul className="flex flex-col gap-0.5">
              {baseNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch
                      title={!isSidebarOpen ? item.title : undefined}
                      className={`flex h-9 items-center gap-2.5 rounded-[8px] px-2.5 text-[13px] font-medium transition-colors duration-150 ${
                        isActive
                          ? "bg-[#0052a5]/[0.10] text-[#0052a5]"
                          : "text-[var(--v2-text-text-muted,#525252)] hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--v2-text-text-base,#171717)]"
                      }`}
                    >
                      <item.icon
                        className={`size-4 shrink-0 ${
                          isActive
                            ? "text-[#0052a5]"
                            : "text-[var(--v2-icon-icon-muted,#737373)]"
                        } ${!isSidebarOpen ? "mx-auto" : ""}`}
                        strokeWidth={1.5}
                      />
                      {isSidebarOpen && (
                        <span className="truncate">{item.title}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Collapsible Staff Console — Unified `h-9` rows */}
            {adminNavItems.length > 0 && (
              <div>
                {isSidebarOpen && (
                  <button
                    type="button"
                    onClick={toggleAdminExpanded}
                    className="mb-2 flex h-8 w-full items-center justify-between rounded-[8px] px-2.5 text-[12px] font-medium text-[var(--v2-text-text-faint,#737373)] transition-colors duration-150 hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--v2-text-text-base,#171717)]"
                  >
                    <span>{t("Staff Console", "管理后台")}</span>
                    {showAdminItems ? (
                      <ChevronDown className="size-3.5" strokeWidth={1.5} />
                    ) : (
                      <ChevronRight className="size-3.5" strokeWidth={1.5} />
                    )}
                  </button>
                )}

                {(showAdminItems || !isSidebarOpen) && (
                  <ul className="flex flex-col gap-0.5">
                    {adminNavItems.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            prefetch
                            title={!isSidebarOpen ? item.title : undefined}
                            className={`flex h-9 items-center gap-2.5 rounded-[8px] px-2.5 text-[13px] font-medium transition-colors duration-150 ${
                              isActive
                                ? "bg-[#0052a5]/[0.10] text-[#0052a5]"
                                : "text-[var(--v2-text-text-muted,#525252)] hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--v2-text-text-base,#171717)]"
                            }`}
                          >
                            <item.icon
                              className={`size-4 shrink-0 ${
                                isActive
                                  ? "text-[#0052a5]"
                                  : "text-[var(--v2-icon-icon-muted,#737373)]"
                              } ${!isSidebarOpen ? "mx-auto" : ""}`}
                              strokeWidth={1.5}
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

        {/* Bottom Controls: Language Switcher + User Row */}
        {isSidebarOpen ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1 px-1">
              <LanguageSwitcher className="flex-1 justify-center" />
              <NotificationBell inbox={inbox} />
            </div>
            <div className="flex items-center gap-2 rounded-[12px] bg-[var(--v2-background-bg-base,#ffffff)] px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[var(--v2-text-text-base,#171717)]">
                  {user?.name || t("CZVG Pilot", "CZVG 飞行员")}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                title={t("Sign out", "退出登录")}
                aria-label={t("Sign out", "退出登录")}
                className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--v2-text-text-muted,#525252)] transition-colors duration-150 hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--v2-text-text-base,#171717)] disabled:opacity-50"
              >
                <LogOut className="size-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <LanguageSwitcher compact className="size-8 p-0" />
            <NotificationBell inbox={inbox} />
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              title={
                user?.name
                  ? `${t("Sign out", "退出登录")} · ${user.name}`
                  : t("Sign out", "退出登录")
              }
              aria-label={t("Sign out", "退出登录")}
              className="mx-auto flex size-8 items-center justify-center rounded-[8px] bg-[var(--v2-background-bg-base,#ffffff)] text-[var(--v2-text-text-muted,#525252)] transition-colors duration-150 hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--v2-text-text-base,#171717)] disabled:opacity-50"
            >
              <LogOut className="size-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Drawer */}
      <Sheet>
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-3 bg-[var(--v2-background-bg-deep,#f3f4f6)] px-4 md:hidden">
          <Link href="/crew/home" aria-label={t("Dashboard", "飞行员主页")} className="min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandLogoSrc} alt="China Southern Virtual Group" className="brand-logo-light h-7 w-auto max-w-[130px] object-contain" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandLogoWhiteSrc} alt="China Southern Virtual Group" className="brand-logo-dark h-7 w-auto max-w-[130px] object-contain" />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex h-11 items-center gap-2 rounded-[10px] bg-[var(--v2-background-bg-base,#ffffff)] px-3 text-[13px] font-medium text-[var(--v2-text-text-base,#171717)]"
                aria-label={t("Open crew center sidebar", "打开机组中心菜单")}
              >
                <Menu className="size-4" strokeWidth={1.5} />
                <span>{t("Menu", "菜单")}</span>
              </button>
            </SheetTrigger>
            {/* Outside the drawer: a popover inside the Sheet's scroll lock could not scroll. */}
            <NotificationBell
              inbox={inbox}
              side="bottom"
              align="end"
              className="size-11 rounded-[10px] bg-[var(--v2-background-bg-base,#ffffff)]"
            />
          </div>
        </div>
        <SheetContent
          side="left"
          className="w-[min(320px,calc(100%-2rem))] gap-0 border-0 bg-[var(--v2-background-bg-deep,#f3f4f6)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div className="mb-3 flex h-9 items-center justify-between gap-2 px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandLogoSrc}
              alt="China Southern Virtual Group"
              className="brand-logo-light h-7 w-auto max-w-[140px] object-contain"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandLogoWhiteSrc}
              alt="China Southern Virtual Group"
              className="brand-logo-dark h-7 w-auto max-w-[140px] object-contain"
            />
            <SheetTitle className="sr-only">CZVG Crew</SheetTitle>
          </div>
          <nav aria-label="Mobile Crew Center navigation" className="min-h-0 flex-1 overflow-y-auto">
            <ul className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch
                      className={`flex min-h-11 items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] font-medium transition-colors duration-150 ${
                        isActive
                          ? "bg-[#0052a5]/[0.10] text-[#0052a5]"
                          : "text-[var(--v2-text-text-muted,#525252)] hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--v2-text-text-base,#171717)]"
                      }`}
                    >
                      <item.icon className="size-4 shrink-0" strokeWidth={1.5} />
                      <span>{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-4 shrink-0 border-t border-black/[0.06] pt-4">
            <div className="flex items-center gap-2 rounded-[12px] bg-[var(--v2-background-bg-base,#ffffff)] px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[var(--v2-text-text-base,#171717)]">
                  {user?.name || t("CZVG Pilot", "CZVG 飞行员")}
                </p>
              </div>
              <LanguageSwitcher compact className="size-9 shrink-0 p-0" />
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                title={t("Sign out", "退出登录")}
                aria-label={t("Sign out", "退出登录")}
                className="flex size-9 shrink-0 items-center justify-center rounded-[8px] text-[var(--v2-text-text-muted,#525252)] transition-colors duration-150 hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--v2-text-text-base,#171717)] disabled:opacity-50"
              >
                <LogOut className="size-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Panel */}
      <div
        data-slot="home-panel"
        className="mx-2 mb-2 flex min-w-0 flex-1 flex-col rounded-[16px] bg-[var(--v2-background-bg-base,#ffffff)] shadow-[var(--v2-elevation-raised)] md:m-2 md:min-h-[calc(100vh-16px)]"
      >
        <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
