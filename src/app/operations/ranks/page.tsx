import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Award, Clock3, Plane, ShieldCheck, Star, Trophy } from "lucide-react";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { models } from "@/lib/models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PublicRank = {
  id: number;
  name: string;
  timereq: number;
  imageurl: string | null;
  barcount: number;
  bartone: "gold" | "white";
  starcount: number;
  aircraft: string[];
};

type FeaturedAward = {
  id: number;
  name: string;
  description: string;
  imageurl: string;
};

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

async function loadRankPageData() {
  const [rankRows, aircraftRows, awardRow] = await Promise.all([
    models.Rank.findAll({
      attributes: ["id", "name", "timereq", "imageurl", "barcount", "bartone", "starcount"],
      order: [["timereq", "ASC"]],
      raw: true,
    }),
    models.Aircraft.findAll({
      where: { status: 1 },
      attributes: ["name", "rankreq"],
      order: [["name", "ASC"]],
      raw: true,
    }),
    models.Award.findOne({
      where: { featured: 1 },
      attributes: ["id", "name", "description", "imageurl"],
      raw: true,
    }),
  ]);

  const aircraftByRank = new Map<number, Set<string>>();
  for (const aircraft of aircraftRows as any[]) {
    const rankId = Number(aircraft.rankreq);
    if (!rankId) continue;
    const names = aircraftByRank.get(rankId) || new Set<string>();
    names.add(String(aircraft.name));
    aircraftByRank.set(rankId, names);
  }

  const ranks: PublicRank[] = (rankRows as any[]).map((rank) => ({
    id: Number(rank.id),
    name: String(rank.name),
    timereq: Number(rank.timereq),
    imageurl: rank.imageurl ? String(rank.imageurl) : null,
    barcount: Number(rank.barcount) || 1,
    bartone: rank.bartone === "white" ? "white" : "gold",
    starcount: Number(rank.starcount) || 0,
    aircraft: Array.from(aircraftByRank.get(Number(rank.id)) || []),
  }));

  return { ranks, featuredAward: awardRow as FeaturedAward | null };
}

export default async function RanksPage() {
  const { ranks, featuredAward } = await loadRankPageData();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        <section className="site-section bg-slate-950 text-white">
          <div className="site-container">
            <div className="mb-5 flex items-center gap-2 text-sm text-slate-300">
              <Link href="/" className="hover:text-sky-200">Home</Link><span>/</span>
              <Link href="/operations" className="hover:text-sky-200">Operations</Link><span>/</span>
              <span className="text-white">Ranks</span>
            </div>
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase text-sky-200">Pilot ranks</p>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">Progress through the fleet as your flight time grows.</h1>
              <p className="mt-5 text-lg leading-8 text-slate-300">Use this rank guide to see flight-hour requirements, aircraft unlocks, and special pilot rewards.</p>
            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <div className="mb-8 max-w-3xl">
              <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-primary" /><p className="site-eyebrow">Rank ladder</p></div>
              <h2 className="site-heading mt-3">Aircraft unlocks by rank.</h2>
              <p className="site-copy mt-4">Each tier lists the flight-time range and active aircraft available at that rank.</p>
            </div>

            {ranks.length === 0 ? (
              <div className="rounded-md border border-dashed p-10 text-center text-slate-500">Rank information is being updated. Please check back soon.</div>
            ) : (
              <div className="space-y-5">
                {ranks.map((rank, index) => {
                  const nextRank = ranks[index + 1];
                  const range = nextRank ? `${formatTime(rank.timereq)}–${formatTime(nextRank.timereq)}` : `${formatTime(rank.timereq)}+`;
                  return (
                    <article key={rank.id} className="overflow-hidden rounded-md bg-slate-950 text-white shadow-sm ring-1 ring-slate-900/10">
                      <div className="grid grid-cols-[76px_minmax(0,1fr)] md:min-h-[220px] md:grid-cols-[132px_minmax(0,1fr)_330px]">
                        <div className="row-span-2 flex min-h-full items-stretch justify-start bg-black md:row-span-1">
                          <div className="flex items-stretch gap-2.5 md:gap-3">
                            {Array.from({ length: rank.barcount }).map((_, barIndex) => <span key={`${rank.id}-bar-${barIndex}`} className={`w-2 md:w-4 ${rank.bartone === "white" ? "bg-white" : "bg-amber-400"}`} />)}
                          </div>
                          {rank.starcount ? <div className="flex flex-1 flex-col items-center justify-center gap-2 px-1.5 md:px-2">{Array.from({ length: rank.starcount }).map((_, starIndex) => <Star key={`${rank.id}-star-${starIndex}`} className="h-4 w-4 fill-amber-300 text-amber-300 md:h-6 md:w-6" />)}</div> : null}
                        </div>
                        <div className="p-6 md:p-8">
                          <div className="flex flex-wrap items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-sm font-bold text-slate-950">{index + 1}</span><span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-100"><Clock3 className="h-3.5 w-3.5" />{range} Flight Time</span></div>
                          <h3 className="mt-5 text-3xl font-bold leading-tight sm:text-4xl">{rank.name}</h3>
                          <div className="mt-4"><p className="text-xs font-semibold uppercase text-sky-200">Aircraft Unlocked</p><p className="mt-1 text-xl font-bold text-white sm:text-2xl">{rank.aircraft.length ? rank.aircraft.join(", ") : "No rank-specific aircraft"}</p></div>
                        </div>
                        <div className="bg-black/30 px-6 pb-6 md:flex md:items-end md:p-6">
                          <div className="flex h-28 w-full items-center justify-center sm:h-36 md:h-40">
                            {rank.imageurl ? <Image src={rank.imageurl} alt={`${rank.name} aircraft`} width={600} height={240} unoptimized className="h-full w-full object-contain" /> : <Plane className="h-16 w-16 text-white/30" aria-hidden="true" />}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {featuredAward ? (
          <section className="site-section bg-slate-50">
            <div className="site-container"><div className="mx-auto max-w-4xl"><article className="site-card border-primary/30 bg-primary p-6 text-white md:p-8"><div className="grid gap-6 md:grid-cols-[1fr_180px] md:items-center"><div><div className="flex h-12 w-12 items-center justify-center rounded-md bg-white/15"><Trophy className="h-6 w-6" /></div><p className="mt-6 text-xs font-semibold uppercase text-sky-100">Featured Award</p><h2 className="mt-3 text-3xl font-bold leading-tight">{featuredAward.name}</h2><div className="mt-6 rounded-md bg-white p-5 text-primary"><div className="flex items-center gap-3"><Award className="h-6 w-6" /><p className="text-lg font-bold">Pilot recognition</p></div><p className="mt-3 text-sm leading-6 text-slate-600">{featuredAward.description}</p></div></div><Image src={featuredAward.imageurl} alt={featuredAward.name} width={360} height={360} unoptimized className="mx-auto max-h-44 w-full object-contain" /></div></article></div></div>
          </section>
        ) : null}

        <section className="bg-primary py-16 text-white"><div className="site-container text-center"><h2 className="text-3xl font-bold">Ready to climb the ranks?</h2><p className="mx-auto mt-4 max-w-2xl text-white/80">Join the crew center, file flights, and unlock aircraft as your hours grow.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild className="bg-white text-primary hover:bg-white/90"><Link href="/crew?type=signup">Apply Now<ArrowRight className="h-4 w-4" /></Link></Button><Button asChild variant="outline" className="border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link href="/operations/fleet">View Fleet</Link></Button></div></div></section>
      </main>
      <Footer />
    </div>
  );
}
