"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="https://sea1.discourse-cdn.com/infiniteflight/user_avatar/community.infiniteflight.com/chinasouthernvg/288/886608_2.png"
              alt="China Southern Virtual Group Logo"
              className="h-6 w-6"
            />
            <div className="flex flex-col">
              <span className="text-xl font-bold">
                China Southern Virtual Group
              </span>
              <span className="text-xs text-muted-foreground">CZVG</span>
            </div>
          </Link>
        </div>
        <nav className="hidden md:flex gap-6">
          <Link
            href="/"
            className="text-sm font-medium hover:underline underline-offset-4"
          >
            Home
          </Link>
          <Link
            href="/about-us"
            className="text-sm font-medium hover:underline underline-offset-4"
          >
            About Us
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium hover:underline underline-offset-4">
              Operations
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white border rounded-md shadow-md">
              <DropdownMenuItem>
                <Link href="/operations/hubs" className="flex w-full">
                  Hubs
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/operations/fleet" className="flex w-full">
                  Fleet
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/operations/routes" className="flex w-full">
                  Routes
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            href="/crew"
            className="text-sm font-medium hover:underline underline-offset-4"
          >
            Join Us
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <Button
            asChild
            variant="default"
            className="bg-primary text-white hidden md:inline-flex"
          >
            <Link href="/crew">Pilot Portal</Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="md:hidden bg-white"
            onClick={() => setMobileMenuOpen(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10 transform ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        } transition-transform duration-200 ease-in-out md:hidden`}
      >
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="https://sea1.discourse-cdn.com/infiniteflight/user_avatar/community.infiniteflight.com/chinasouthernvg/288/886608_2.png"
              alt="China Southern Virtual Group Logo"
              className="h-6 w-6"
            />
            <span className="text-xl font-bold">
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
              <Link
                href="/"
                className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/crew-center"
                className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Crew Center
              </Link>
              <Link
                href="/about-us"
                className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <div className="-mx-3 px-3 py-2 text-base font-semibold leading-7 text-gray-900">
                Operations
              </div>
              <Link
                href="/operations/hubs"
                className="-mx-3 block rounded-lg px-3 py-2 pl-6 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Hubs
              </Link>
              <Link
                href="/operations/fleet"
                className="-mx-3 block rounded-lg px-3 py-2 pl-6 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Fleet
              </Link>
              <Link
                href="/operations/routes"
                className="-mx-3 block rounded-lg px-3 py-2 pl-6 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Routes
              </Link>
              <Link
                href="/crew"
                className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Join Us
              </Link>
            </div>
            <div className="py-6">
              <Button
                asChild
                variant="default"
                className="w-full bg-primary text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Link href="/crew">Pilot Portal</Link>
              </Button>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
