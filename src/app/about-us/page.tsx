import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Building2, Globe2, Plane } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { groupAirlines } from "@/lib/group-airlines";

const facts = [
  { icon: Building2, label: "Founded", value: "July 2021" },
  { icon: Globe2, label: "Network", value: "300+ destinations" },
  { icon: Plane, label: "Routes", value: "1000+ flight options" },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        <section className="site-section bg-slate-950 text-white">
          <div className="site-container">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase text-sky-200">
                About CZVG
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                A China-based virtual airline group for Infinite Flight pilots.
              </h1>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                China Southern Virtual Group brings a broad Chinese airline
                network, realistic hub operations, and varied aircraft choices
                into the Infinite Flight community.
              </p>
            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-start">
              <div>
                <p className="site-eyebrow">Our background</p>
                <h2 className="site-heading mt-3">
                  Built around China Southern and its partner network.
                </h2>
                <div className="mt-5 space-y-5 text-base leading-8 text-slate-600">
                  <p>
                    Founded in July 2021, China Southern Virtual Group was
                    established to bring another China-based airline experience
                    to Infinite Flight. Our primary hubs are Guangzhou Baiyun
                    and Beijing Daxing.
                  </p>
                  <p>
                    Inspired by one of the largest airlines in China, we fly to
                    more than 300 destinations across over 1,000 routes from our
                    hubs and focus cities. We also offer a wide variety of
                    aircraft for pilots to fly.
                  </p>
                  <p className="font-semibold text-slate-950">
                    Join China Southern Virtual Group today to explore the
                    exciting world of virtual flight with us.
                  </p>
                </div>
              </div>
              <div className="grid gap-4">
                {facts.map((fact) => {
                  const Icon = fact.icon;

                  return (
                    <div key={fact.label} className="site-card p-5">
                      <Icon className="h-5 w-5 text-primary" />
                      <p className="mt-4 text-sm font-medium text-slate-500">
                        {fact.label}
                      </p>
                      <p className="mt-1 text-xl font-bold text-slate-950">
                        {fact.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="site-section bg-slate-50">
          <div className="site-container">
            <div className="max-w-3xl">
              <p className="site-eyebrow">Our group airlines</p>
              <h2 className="site-heading mt-3">
                One group, one connected aviation network.
              </h2>
              <p className="site-copy mt-5">
                Our virtual group represents the passenger, cargo, and general
                aviation operations within the China Southern Air Holding network.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {groupAirlines.map((airline) => (
                <article
                  key={airline.name}
                  className={`site-card ${
                    airline.regionalAirlines
                      ? "p-6 sm:p-8 md:col-span-2 lg:col-span-3"
                      : "p-5"
                  }`}
                >
                  <div
                    className={
                      airline.regionalAirlines
                        ? "grid gap-6 md:grid-cols-[240px_1fr] md:items-center"
                        : ""
                    }
                  >
                    <div
                      className={`flex items-center justify-center rounded-md bg-slate-50 p-4 ${
                        airline.regionalAirlines ? "h-40" : "h-28"
                      }`}
                    >
                      <Image
                        src={airline.logo}
                        alt={`${airline.name} logo`}
                        width={180}
                        height={90}
                        className="h-20 w-full object-contain"
                      />
                    </div>
                    <div>
                      <h3
                        className={`font-bold text-slate-950 ${
                          airline.regionalAirlines
                            ? "text-2xl sm:text-3xl"
                            : "mt-5 text-lg"
                        }`}
                      >
                        {airline.planespottersUrl ? (
                          <a
                            href={airline.planespottersUrl}
                            className="rounded-sm underline decoration-slate-300 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
                          >
                            {airline.name}
                          </a>
                        ) : (
                          airline.name
                        )}
                      </h3>
                      {airline.type === "cargo" && (
                        <span className="site-badge mt-3">CARGO</span>
                      )}
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {airline.description}
                      </p>
                    </div>
                  </div>
                  {airline.regionalAirlines && (
                    <div className="mt-6 border-t border-slate-200 pt-6">
                      <h4 className="text-sm font-semibold text-slate-950">
                        Regional airlines
                      </h4>
                      <ul className="mt-3 grid list-disc gap-x-8 gap-y-2 pl-5 text-sm leading-6 text-slate-600 sm:grid-cols-2">
                        {airline.regionalAirlines.map((regionalAirline) => (
                          <li key={regionalAirline}>{regionalAirline}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-primary py-16 text-white">
          <div className="site-container text-center">
            <h2 className="text-3xl font-bold">Ready to join our team?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/80">
              Become part of our virtual pilot community and start your journey
              today.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="bg-white text-primary hover:bg-white/90">
                <Link href="/crew?type=signup">
                  Apply Now
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/operations">Explore Operations</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
