import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Database, Map, Plane } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const maps = [
  {
    src: "https://www.google.com/maps/d/embed?mid=1WEqoxQ5vrtWtqnLRG3J6iZ8ETRALeGm6&ehbc=2E312F",
    title: "China Southern Airlines Route Network",
  },
  {
    src: "https://www.google.com/maps/d/embed?mid=1NsyoNS1wTR1EL6xqQVQekk-VzW_A-sGz&ehbc=2E312F",
    title: "Xiamen Airlines Route Network",
  },
  {
    src: "https://www.google.com/maps/d/embed?mid=1d9YI86mJca95WoM56MiP-p-My4JLyjv2&ehbc=2E312F",
    title: "Chengdu Airlines Route Network",
  },
  {
    src: "https://www.google.com/maps/d/embed?mid=1bp5K5xbt6hIgRgyTtKj1h9aMMlKvUHzE&ehbc=2E312F",
    title: "Hebei Airlines Route Network",
  },
  {
    src: "https://www.google.com/maps/d/embed?mid=1aKencXbuaoExxWIkXPEEqQzf_nFCa-Mu&ehbc=2E312F",
    title: "Jiangxi Airlines Route Network",
  },
  {
    src: "https://www.google.com/maps/d/embed?mid=1ZPcLrGGiHFiJ6-wr6fPAbSyq9mEK49yy&ehbc=2E312F",
    title: "Chongqing Airlines Route Network",
  },
];

const partners = [
  {
    name: "American Virtual",
    logo: "https://global.discourse-cdn.com/infiniteflight/original/4X/f/6/6/f66924dfe2dd443e42ef83213071371331f0d375.png",
  },
  {
    name: "Air France KLM Group",
    logo: "https://upload.wikimedia.org/wikipedia/commons/6/65/Air_France_KLM_Group_logo.svg",
  },
  {
    name: "Air Europa Virtual",
    logo: "https://sea1.discourse-cdn.com/infiniteflight/user_avatar/community.infiniteflight.com/aireuropavirtual/288/799321_2.png",
  },
  {
    name: "Qatar Airways",
    logo: "https://upload.wikimedia.org/wikipedia/en/9/9b/Qatar_Airways_Logo.svg",
  },
  {
    name: "Dubai Virtual",
    logo: "https://dubaiva.weebly.com/uploads/1/3/2/6/132622991/dubai-virtual-airlines-logo-2-white-writing_orig.png",
  },
  {
    name: "Saudia Virtual",
    logo: "https://global.discourse-cdn.com/infiniteflight/original/4X/7/1/7/7175e1702c01503341f88921b30db1d60fa04747.png",
  },
  {
    name: "Etihad Virtual",
    logo: "https://sea1.discourse-cdn.com/infiniteflight/user_avatar/community.infiniteflight.com/etihad_virtual/288/851859_2.png",
  },
  {
    name: "WestJet",
    logo: "https://upload.wikimedia.org/wikipedia/commons/1/16/WestJetLogo2018.svg",
  },
];

export default function RoutesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        <section className="site-section bg-slate-950 text-white">
          <div className="site-container">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase text-sky-200">
                Routes
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                A large network for short sectors, long hauls, and partner ops.
              </h1>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Discover the CZVG route database, airline-specific network maps,
                and codeshare partners.
              </p>
            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <div className="mb-6 flex items-center gap-3">
              <Database className="h-6 w-6 text-primary" />
              <div>
                <p className="site-eyebrow">Route database</p>
                <h2 className="site-heading mt-1">Browse available routes.</h2>
              </div>
            </div>
            <div className="site-card overflow-hidden p-3">
              <div className="aspect-[16/9]">
                <iframe
                  src="https://docs.google.com/spreadsheets/d/e/2PACX-1vQy_RZcm7fYgsDP1kmXyUAdVonqUegj5MeoNmflJJxKGuers9kTO1mDlYdpRlDJU6OQTc-trocUHDM1/pubhtml"
                  className="h-full w-full rounded"
                  title="CZVG route database"
                  style={{ border: 0 }}
                />
              </div>
              <p className="mt-3 rounded-md bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
                Route database displayed here may be outdated. Crew Center
                routes are the most up-to-date source.
              </p>
            </div>
          </div>
        </section>

        <section className="site-section bg-slate-50">
          <div className="site-container">
            <div className="mb-8 max-w-3xl">
              <div className="flex items-center gap-3">
                <Map className="h-6 w-6 text-primary" />
                <p className="site-eyebrow">Route network</p>
              </div>
              <h2 className="site-heading mt-3">
                Airline-specific network maps.
              </h2>
              <p className="site-copy mt-4">
                Explore routes across China Southern, Xiamen Air, Chengdu
                Airlines, Hebei Airlines, Jiangxi Air, and Chongqing Airlines.
              </p>
            </div>
            <div className="grid gap-6">
              {maps.map((map) => (
                <div key={map.title} className="site-card overflow-hidden p-3">
                  <div className="aspect-[16/9]">
                    <iframe
                      src={map.src}
                      title={map.title}
                      className="h-full w-full rounded"
                      loading="lazy"
                    />
                  </div>
                  <p className="mt-3 text-center text-sm font-medium text-slate-600">
                    {map.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <div className="mb-8 max-w-3xl">
              <p className="site-eyebrow">Codeshare partners</p>
              <h2 className="site-heading mt-3">
                More flying through partner networks.
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {partners.map((partner) => (
                <div key={partner.name} className="site-card p-4 text-center">
                  <div className="relative mx-auto h-24 w-full">
                    <Image
                      src={partner.logo}
                      alt={`${partner.name} logo`}
                      fill
                      className="object-contain"
                      unoptimized={partner.logo.includes("upload.wikimedia.org")}
                    />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-slate-950">
                    {partner.name}
                  </h3>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm text-slate-500">And more partners.</p>
          </div>
        </section>

        <section className="bg-primary py-16 text-white">
          <div className="site-container text-center">
            <Plane className="mx-auto h-8 w-8 text-white/80" />
            <h2 className="mt-4 text-3xl font-bold">
              Ready to explore our routes?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/80">
              Join our virtual airline group today and fly to destinations
              around the world.
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
                <Link href="/operations/fleet">View Our Fleet</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
