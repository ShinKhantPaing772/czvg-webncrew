import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Award, MapPinned, Plane, Route } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const operations = [
  {
    title: "Our Fleet",
    description:
      "Explore aircraft ranging from regional jets to wide-body long-haul aircraft.",
    href: "/operations/fleet",
    image:
      "https://global.discourse-cdn.com/infiniteflight/original/4X/4/4/9/449f11d44e6be0994c1ac7fd69a0565967bd46ab.png",
    icon: Plane,
    imageStyle: "aircraft",
  },
  {
    title: "Our Routes",
    description:
      "Discover a large domestic and international network built for virtual pilots.",
    href: "/operations/routes",
    image:
      "https://global.discourse-cdn.com/infiniteflight/original/4X/8/e/f/8eff2df8d46564a0d6ebeb6f6776078af2073377.jpeg",
    icon: Route,
  },
  {
    title: "Our Hubs",
    description:
      "Learn about our main hubs, focus cities, and subsidiary airline bases.",
    href: "/operations/hubs",
    image:
      "https://global.discourse-cdn.com/infiniteflight/optimized/4X/9/0/3/9032d2dcfa32d3d3ebab7f79d3a02c0c833fdd58_2_1640x1138.jpeg",
    icon: MapPinned,
  },
  {
    title: "Pilot Ranks",
    description:
      "Review flight-hour rank progression, unlocked aircraft, and CEO rewards.",
    href: "/operations/ranks",
    image:
      "https://global.discourse-cdn.com/infiniteflight/optimized/4X/1/d/4/1d49408bf5b2a652de2fe4feccb091a8a485f6f1_2_1640x418.png",
    icon: Award,
    imageStyle: "rank",
  },
];

export default function OperationsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        <section className="site-section bg-slate-950 text-white">
          <div className="site-container">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase text-sky-200">
                Operations
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                Fleet, routes, and hubs built around realistic virtual flying.
              </h1>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Explore our aircraft, route network, and operational bases
                across China and beyond.
              </p>
            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <div>
                <p className="site-eyebrow">Network overview</p>
                <h2 className="site-heading mt-3">
                  A broad operation with room for every flight style.
                </h2>
                <p className="site-copy mt-5">
                  China Southern Virtual Group operates one of the most
                  extensive networks in the virtual aviation community. With
                  over 300 destinations and 1000+ routes, pilots can choose
                  short domestic sectors, international wide-body flights, and
                  codeshare operations.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ["300+", "Destinations"],
                  ["1000+", "Routes"],
                  ["6", "Airlines"],
                ].map(([value, label]) => (
                  <div key={label} className="site-card p-5">
                    <p className="text-3xl font-bold text-primary">{value}</p>
                    <p className="mt-2 text-sm font-medium text-slate-600">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="site-section bg-slate-50">
          <div className="site-container">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {operations.map((operation) => {
                const Icon = operation.icon;

                return (
                  <Link
                    key={operation.title}
                    href={operation.href}
                    className="site-card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div
                      className={
                        operation.imageStyle
                          ? "relative h-52 overflow-hidden bg-slate-950"
                          : "relative h-52 bg-slate-100"
                      }
                    >
                      {operation.imageStyle === "rank" ? (
                        <div className="absolute inset-y-0 left-0 z-10 flex gap-2.5 bg-black px-2">
                          {[0, 1, 2, 3].map((bar) => (
                            <span key={bar} className="w-2 bg-amber-400" />
                          ))}
                        </div>
                      ) : null}
                      <Image
                        src={operation.image}
                        alt={operation.title}
                        fill
                        className={
                          operation.imageStyle === "rank"
                            ? "object-contain py-5 pl-20 pr-5 transition-transform duration-300 group-hover:scale-105"
                            : operation.imageStyle
                              ? "object-contain p-5 transition-transform duration-300 group-hover:scale-105"
                            : "object-cover transition-transform duration-300 group-hover:scale-105"
                        }
                      />
                    </div>
                    <div className="p-6">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-5 text-2xl font-bold text-slate-950">
                        {operation.title}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {operation.description}
                      </p>
                      <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                        Learn more
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-primary py-16 text-white">
          <div className="site-container text-center">
            <h2 className="text-3xl font-bold">Ready to start flying?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/80">
              Join our virtual airline group and experience China Southern
              operations across Infinite Flight.
            </p>
            <div className="mt-8">
              <Button asChild className="bg-white text-primary hover:bg-white/90">
                <Link href="/crew?type=signup">Apply Now</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
