import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, Clock3, ShieldCheck, Star, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const ranks = [
  {
    title: "Trainee Second Officer",
    hours: "0-21hr",
    aircraft: "E190",
    bars: 1,
    barTone: "white",
    image:
      "https://global.discourse-cdn.com/infiniteflight/original/4X/9/f/d/9fddae7f609a83f4d5f0f0b9cecfe41fce096836.png",
  },
  {
    title: "Second Officer",
    hours: "21-70hr",
    aircraft: "A319, A320, A321",
    bars: 1,
    image:
      "https://global.discourse-cdn.com/infiniteflight/original/4X/7/6/2/762e27e54b98ad4c9c894fca9ee8c1dfa994affb.png",
  },
  {
    title: "First Officer",
    hours: "70-140hr",
    aircraft: "B737",
    bars: 2,
    image:
      "https://global.discourse-cdn.com/infiniteflight/original/4X/7/c/0/7c0231e4927f43356d12e9e839d1fd21183c49de.png",
  },
  {
    title: "SR First Officer",
    hours: "140-230hr",
    aircraft: "A330, B757",
    bars: 3,
    image:
      "https://global.discourse-cdn.com/infiniteflight/original/4X/7/e/7/7e774e9d23860935ce53d0d8f8ca8624a9f5d214.png",
  },
  {
    title: "Captain",
    hours: "230-400hr",
    aircraft: "777F, B777",
    bars: 4,
    image:
      "https://global.discourse-cdn.com/infiniteflight/original/4X/0/4/0/0401c2231ffaac4ddfeac1309ce8f7f134f65991.png",
  },
  {
    title: "SR Captain",
    hours: "400-800hr",
    aircraft: "B787, A350, A380",
    bars: 4,
    starCount: 1,
    image:
      "https://global.discourse-cdn.com/infiniteflight/original/4X/9/7/d/97dc473f7f9d9520e894038c9048b2ae8b2eadab.png",
  },
  {
    title: "Fleet Captain",
    hours: "800+hr",
    aircraft: "B74F",
    bars: 4,
    starCount: 2,
    image:
      "https://global.discourse-cdn.com/infiniteflight/optimized/4X/1/d/4/1d49408bf5b2a652de2fe4feccb091a8a485f6f1_2_1640x418.png",
  },
];

export default function RanksPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        <section className="site-section bg-slate-950 text-white">
          <div className="site-container">
            <div className="mb-5 flex items-center gap-2 text-sm text-slate-300">
              <Link href="/" className="hover:text-sky-200">
                Home
              </Link>
              <span>/</span>
              <Link href="/operations" className="hover:text-sky-200">
                Operations
              </Link>
              <span>/</span>
              <span className="text-white">Ranks</span>
            </div>
            <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-end">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase text-sky-200">
                  Pilot ranks
                </p>
                <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                  Progress through the fleet as your flight time grows.
                </h1>
                <p className="mt-5 text-lg leading-8 text-slate-300">
                  Use this rank guide to see flight-hour requirements, aircraft
                  unlocks, Fleet Captain status, and CEO rewards.
                </p>
              </div>

            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <div className="mb-8 max-w-3xl">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <p className="site-eyebrow">Rank ladder</p>
              </div>
              <h2 className="site-heading mt-3">Aircraft unlocks by rank.</h2>
              <p className="site-copy mt-4">
                Each tier lists the flight-time range and primary aircraft
                available at that rank.
              </p>
            </div>

            <div className="space-y-5">
              {ranks.map((rank, index) => (
                <article
                  key={rank.title}
                  className="overflow-hidden rounded-md bg-slate-950 text-white shadow-sm ring-1 ring-slate-900/10"
                >
                  <div className="grid grid-cols-[76px_minmax(0,1fr)] md:min-h-[220px] md:grid-cols-[132px_minmax(0,1fr)_330px]">
                    <div className="row-span-2 flex min-h-full items-stretch justify-start bg-black md:row-span-1">
                      <div className="flex items-stretch gap-2.5 md:gap-3">
                        {Array.from({ length: rank.bars }).map((_, barIndex) => (
                          <span
                            key={`${rank.title}-bar-${barIndex}`}
                            className={`w-2 md:w-4 ${
                              rank.barTone === "white"
                                ? "bg-white"
                                : "bg-amber-400"
                            }`}
                          />
                        ))}
                      </div>
                      {rank.starCount ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-1.5 md:px-2">
                          {Array.from({ length: rank.starCount }).map(
                            (_, starIndex) => (
                              <Star
                                key={`${rank.title}-star-${starIndex}`}
                                className="h-4 w-4 fill-amber-300 text-amber-300 md:h-6 md:w-6"
                              />
                            )
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="p-6 md:p-8">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-sm font-bold text-slate-950">
                          {index + 1}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-100">
                          <Clock3 className="h-3.5 w-3.5" />
                          {rank.hours} Flight Time
                        </span>
                      </div>
                      <h3 className="mt-5 text-3xl font-bold leading-tight sm:text-4xl">
                        {rank.title}
                      </h3>
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase text-sky-200">
                          Aircraft Unlocked
                        </p>
                        <p className="mt-1 text-xl font-bold text-white sm:text-2xl">
                          {rank.aircraft}
                        </p>
                      </div>
                    </div>
                    <div className="bg-black/30 px-6 pb-6 md:flex md:items-end md:p-6">
                      <div className="relative h-28 w-full sm:h-36 md:h-40">
                        <Image
                          src={rank.image}
                          alt={`${rank.title} aircraft`}
                          fill
                          className="object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section bg-slate-50">
          <div className="site-container">
            <div className="mx-auto max-w-4xl">
              <article className="site-card border-primary/30 bg-primary p-6 text-white md:p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white/15">
                  <Trophy className="h-6 w-6" />
                </div>
                <p className="mt-6 text-xs font-semibold uppercase text-sky-100">
                  CEO&apos;s Award
                </p>
                <h2 className="mt-3 text-3xl font-bold leading-tight">
                  A Reward for the most dedicated pilots.
                </h2>
                <div className="mt-6 rounded-md bg-white p-5 text-primary">
                  <div className="flex items-center gap-3">
                    <Award className="h-6 w-6" />
                    <p className="text-lg font-bold">1.3x multiplier</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    CEO&apos;s Award applies a 1.3x multiplier to all flights.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="bg-primary py-16 text-white">
          <div className="site-container text-center">
            <h2 className="text-3xl font-bold">Ready to climb the ranks?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/80">
              Join the crew center, file flights, and unlock aircraft as your
              hours grow.
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
                <Link href="/operations/fleet">View Fleet</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
