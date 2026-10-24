"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, X, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/hooks/use-session";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { getCrewLandingPath, usesApplicantPortal } from "@/lib/pilot-status";
import { logout } from "@/lib/utils/auth";
import { HalloweenThemeToggle } from "@/components/halloween-theme-toggle";
import { Icon } from "@iconify/react";

const brandLogoSrc = "/brand/czvg-logo-horizontal.png";
const brandLogoWhiteSrc = "/brand/czvg-logo-horizontal-white.png";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user } = useSession();
  const { t } = useI18n();
  const pathname = usePathname();
  const portalHref = getCrewLandingPath(user?.status ?? null);
  const portalLabel = usesApplicantPortal(user?.status ?? null)
    ? t("Applicant Portal", "申请人中心")
    : t("Crew Center", "机组中心");

  const navLinks = [
    { href: "/", label: t("Home", "首页") },
    { href: "/about-us", label: t("About Us", "关于我们") },
  ];

  const operationLinks = [
    { href: "/operations/hubs", label: t("Hubs", "枢纽机场") },
    { href: "/operations/fleet", label: t("Fleet", "机队规模") },
    { href: "/operations/ranks", label: t("Ranks", "飞行员职级") },
    { href: "/operations/routes", label: t("Routes", "航线网络") },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === href : pathname?.startsWith(href);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      logout();
      // Force a page refresh to clear the user state
      window.location.href = "/crew";
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            className="halloween-logo-container flex min-w-0 items-center gap-2 rounded-lg transition-all"
          >
            <img
              src={brandLogoSrc}
              alt="China Southern Virtual Group Logo"
              className="brand-logo-light h-10 w-auto max-w-[190px] shrink-0 object-contain"
            />
            <img
              src={brandLogoWhiteSrc}
              alt="China Southern Virtual Group Logo"
              className="brand-logo-dark h-10 w-auto max-w-[190px] shrink-0 object-contain"
            />
            <span className="halloween-logo-badge hidden items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[11px] font-bold text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.25)] sm:inline-flex">
              CZVG
              <Icon
                icon="fluent-emoji-flat:jack-o-lantern"
                className="h-3.5 w-3.5 shrink-0"
              />
            </span>
          </Link>
        </div>
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "bg-[#eef6ff] text-[#0052a5]"
                  : "text-slate-600 hover:bg-[#0052a5]/[0.05] hover:text-[#003a74]"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive("/operations")
                  ? "bg-[#eef6ff] text-[#0052a5]"
                  : "text-slate-600 hover:bg-[#0052a5]/[0.05] hover:text-[#003a74]"
              }`}
            >
              {t("Operations", "运行中心")}
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-xl border-0 bg-white p-1 shadow-[var(--v2-elevation-floating)]">
              {operationLinks.map((link) => (
                <DropdownMenuItem key={link.href}>
                  <Link href={link.href} className="flex w-full">
                    {link.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {!user ? (
            <Link
              href="/crew?type=signup"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-[#0052a5]/[0.05] hover:text-[#003a74]"
            >
              {t("Join Us", "加入我们")}
            </Link>
          ) : (
            <Link
              href={portalHref}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-[#0052a5]/[0.05] hover:text-[#003a74]"
            >
              {portalLabel}
            </Link>
          )}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <HalloweenThemeToggle />
          <LanguageSwitcher />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  className="hidden bg-primary text-white md:inline-flex"
                >
                  <div className="flex items-center gap-2">
                    <p>{user?.name}</p>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white">
                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  <div className="flex w-full items-center">
                    <LogOut className="mr-2 h-4 w-4" />
                    {isLoggingOut
                      ? t("Logging out...", "正在退出...")
                      : t("Log Out", "退出登录")}
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              asChild
              variant="default"
              className="bg-primary text-white hidden md:inline-flex"
            >
              <Link href="/crew">{t("Pilot Portal", "飞行员门户")}</Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="bg-white md:hidden"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        id="mobile-menu"
        aria-hidden={!mobileMenuOpen}
        className={`fixed inset-y-0 right-0 z-50 w-full transform bg-white px-6 py-6 shadow-xl sm:max-w-sm sm:ring-1 sm:ring-gray-900/10 ${
          mobileMenuOpen
            ? "visible translate-x-0"
            : "hidden invisible translate-x-full pointer-events-none"
        } transition-transform duration-200 ease-in-out md:hidden`}
      >
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="halloween-logo-container flex items-center gap-2 rounded-lg transition-all"
          >
            <img
              src={brandLogoSrc}
              alt="China Southern Virtual Group Logo"
              className="brand-logo-light h-10 w-auto max-w-[220px] object-contain"
            />
            <img
              src={brandLogoWhiteSrc}
              alt="China Southern Virtual Group Logo"
              className="brand-logo-dark h-10 w-auto max-w-[220px] object-contain"
            />
            <span className="halloween-logo-badge inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[11px] font-bold text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.25)]">
              CZVG
              <Icon
                icon="fluent-emoji-flat:jack-o-lantern"
                className="h-3.5 w-3.5 shrink-0"
              />
            </span>
          </Link>
          <Button
            variant="outline"
            size="icon"
            className="bg-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-6 w-6" />
            <span className="sr-only">Close menu</span>
          </Button>
        </div>
        <nav className="mt-6 flow-root">
          <div className="-my-6 divide-y divide-gray-500/10">
            <div className="space-y-2 py-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="-mx-3 block rounded-md px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/crew"
                className="-mx-3 block rounded-md px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Crew Center
              </Link>
              <div className="-mx-3 px-3 py-2 text-base font-semibold leading-7 text-gray-900">
                Operations
              </div>
              {operationLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="-mx-3 block rounded-md px-3 py-2 pl-6 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {!user ? (
                <Link
                  href="/crew?type=signup"
                  className="-mx-3 block rounded-md px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Join Us
                </Link>
              ) : (
                <Link
                  href={portalHref}
                  className="-mx-3 block rounded-md px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {portalLabel}
                </Link>
              )}
            </div>
            <div className="py-6">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" className="w-full bg-primary text-white">
                      <div className="flex items-center gap-2">
                        <p>{user.name}</p>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* <DropdownMenuItem>
                    <Link href="/profile" className="w-full">
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/settings" className="w-full">
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator /> */}
                    <DropdownMenuItem
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                    >
                      <div className="flex w-full items-center">
                        <LogOut className="mr-2 h-4 w-4" />
                        {isLoggingOut ? "Logging out..." : "Log Out"}
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  asChild
                  variant="default"
                  className="w-full bg-primary text-white"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link href="/crew">Pilot Portal</Link>
                </Button>
              )}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
