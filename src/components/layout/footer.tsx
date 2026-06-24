import Link from "next/link";
import { BadgeCheck, ExternalLink, Instagram, MessageCircle } from "lucide-react";

const communityLinks = [
  {
    href: "https://community.infiniteflight.com/",
    label: "Infinite Flight Community",
  },
  {
    href: "https://community.infiniteflight.com/t/china-southern-virtual-group-fly-into-your-dreams-official-thread-2026/1141730?u=gds111006",
    label: "CZVG IFC Thread",
  },
  {
    href: "https://ifvarb.com/",
    label: "IFVARB",
  },
];

const siteLinks = [
  { href: "/", label: "Home" },
  { href: "/about-us", label: "About" },
  { href: "/operations", label: "Operations" },
  { href: "/crew?type=signup", label: "Join Us" },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-white">
      <div className="site-container py-10">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <img
                src="https://sea1.discourse-cdn.com/infiniteflight/user_avatar/community.infiniteflight.com/chinasouthernvg/288/886608_2.png"
                alt="China Southern Virtual Group Logo"
                className="h-9 w-9 rounded-full"
              />
              <div>
                <span className="block text-lg font-bold">
                  China Southern Virtual Group
                </span>
                <span className="text-sm text-slate-300">
                  Fly into your dreams
                </span>
              </div>
            </Link>
            <p className="mt-5 max-w-xl text-sm leading-6 text-slate-300">
              A China-based virtual airline group for Infinite Flight pilots,
              operating a broad network of hubs, focus cities, and partner
              routes.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://ifvarb.com/database.php?action=view&xid=1226"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
              >
                <span className="sr-only">IFVARB</span>
                <BadgeCheck className="h-5 w-5" />
              </a>
              <a
                href="https://community.infiniteflight.com/u/chinasouthernvg/"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
              >
                <span className="sr-only">IFC profile</span>
                <MessageCircle className="h-5 w-5" />
              </a>
              <a
                href="https://www.instagram.com/chinasouthernvg_if/"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
              >
                <span className="sr-only">Instagram</span>
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase text-slate-400">
              Community
            </h2>
            <div className="mt-4 space-y-3">
              {communityLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-white"
                >
                  {link.label}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase text-slate-400">
              Explore
            </h2>
            <div className="mt-4 space-y-3">
              {siteLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-sm text-slate-300 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-xs leading-5 text-slate-400">
          China Southern Virtual Group is a virtual airline exclusively for the
          Infinite Flight platform operating under IFVARB. We have no connection
          or affiliation with China Southern Group and its subsidiaries,
          Infinite Flight, or any real-world airline or organization. All logos
          and trademarks remain the property of their respective owners.
        </div>
      </div>
    </footer>
  );
}
