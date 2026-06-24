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
import { logout } from "@/lib/utils/auth";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user } = useSession();
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/about-us", label: "About Us" },
  ];

  const operationLinks = [
    { href: "/operations/hubs", label: "Hubs" },
    { href: "/operations/fleet", label: "Fleet" },
    { href: "/operations/routes", label: "Routes" },
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
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <img
              src="https://sea1.discourse-cdn.com/infiniteflight/user_avatar/community.infiniteflight.com/chinasouthernvg/288/886608_2.png"
              alt="China Southern Virtual Group Logo"
              className="h-8 w-8 shrink-0 rounded-full"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-base font-bold leading-tight text-slate-950 md:text-lg">
                China Southern Virtual Group
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                CZVG
              </span>
            </div>
          </Link>
        </div>
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "bg-primary/10 text-primary"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive("/operations")
                  ? "bg-primary/10 text-primary"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              Operations
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-md border border-slate-200 bg-white shadow-lg">
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
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
            >
              Join Us
            </Link>
          ) : (
            <Link
              href="/crew/home"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
            >
              Crew Center
            </Link>
          )}
        </nav>
        <div className="flex shrink-0 items-center gap-4">
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
                    {isLoggingOut ? "Logging out..." : "Log Out"}
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
              <Link href="/crew">Pilot Portal</Link>
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
          <Link href="/" className="flex items-center gap-2">
            <img
              src="https://sea1.discourse-cdn.com/infiniteflight/user_avatar/community.infiniteflight.com/chinasouthernvg/288/886608_2.png"
              alt="China Southern Virtual Group Logo"
              className="h-8 w-8 rounded-full"
            />
            <span className="text-lg font-bold leading-tight">
              China Southern Virtual Group
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
                  href="/crew"
                  className="-mx-3 block rounded-md px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Crew Center
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
