import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  MapPinned,
  Plane,
  Route,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { FeaturedRouteRotator } from "@/components/featured-route-rotator";

const stats = [
  { value: "300+", label: "Destinations around the world" },
  { value: "1000+", label: "Routes to fly" },
  { value: "6", label: "Airlines in Operation" },
  { value: "IFVARB", label: "Certified VA" },
];

const highlights = [
  {
    icon: Route,
    title: "Route-rich flying",
    body: "Choose from domestic sectors, long-haul wide-body flights, cargo operations, and partner routes.",
    href: "/operations/routes",
    action: "Explore routes",
  },
  {
    icon: Plane,
    title: "Diverse fleet",
    body: "Fly China Southern, Xiamen Air, Chongqing Airlines, Hebei Airlines, Jiangxi Air, and more.",
    href: "/operations/fleet",
    action: "View fleet",
  },
  {
    icon: Users,
    title: "Pilot community",
    body: "Join an Infinite Flight virtual airline group built around realistic schedules and shared events.",
    href: "/crew?type=signup",
    action: "Apply now",
  },
];

const featuredRoutes = [
  {
    from: "ZGGG",
    to: "ZBAA",
    city: "Guangzhou to Beijing",
    aircraft: "A321neo / B787",
  },
  {
    from: "ZBAD",
    to: "ZSPD",
    city: "Beijing Daxing to Shanghai",
    aircraft: "A320 / B737",
  },
  {
    from: "ZSAM",
    to: "VHHH",
    city: "Xiamen to Hong Kong",
    aircraft: "B737 / B787",
  },
  {
    from: "ZGGG",
    to: "KLAX",
    city: "Guangzhou to Los Angeles",
    aircraft: "B777 / A350",
  },
  {
    from: "ZUCK",
    to: "ZGGG",
    city: "Chongqing to Guangzhou",
    aircraft: "A320 / B737",
  },
  {
    from: "ZUUU",
    to: "ZBAA",
    city: "Chengdu to Beijing",
    aircraft: "A321 / A330",
  },
  {
    from: "ZBSJ",
    to: "ZSAM",
    city: "Shijiazhuang to Xiamen",
    aircraft: "B737 / A320",
  },
  {
    from: "ZSCN",
    to: "ZGGG",
    city: "Nanchang to Guangzhou",
    aircraft: "B737 / A320",
  },
  {
    from: "ZGGG",
    to: "EGLL",
    city: "Guangzhou to London Heathrow",
    aircraft: "B787 / A350",
  },
  {
    from: "ZBAD",
    to: "RJTT",
    city: "Beijing Daxing to Tokyo Haneda",
    aircraft: "A321neo / B737",
  },
  {
    from: "ZSAM",
    to: "WSSS",
    city: "Xiamen to Singapore",
    aircraft: "B787 / B737",
  },
  {
    from: "ZGGG",
    to: "YSSY",
    city: "Guangzhou to Sydney",
    aircraft: "A350 / B787",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-950">
      <Header />
      <main className="flex-1">
        <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
          <Image
            src="https://global.discourse-cdn.com/infiniteflight/optimized/4X/b/2/2/b22accbeaac5157362ab1d669b01ff967eb6f50c_2_1600x1200.jpeg?height=1080&width=1920"
            alt="China Southern aircraft on the runway"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,24,49,0.92),rgba(2,24,49,0.76)_46%,rgba(2,24,49,0.2))]" />
          <div className="site-container relative z-10 flex min-h-[calc(100vh-4rem)] items-center py-14">
            <div className="max-w-4xl pb-16 pt-10 text-white">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase text-white/85 backdrop-blur">
                <BadgeCheck className="h-4 w-4 text-sky-200" />
                IFVARB Approved Virtual Airline
              </div>
              <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
                China Southern Virtual Group
              </h1>
              <p className="mt-4 text-2xl font-semibold text-sky-100 sm:text-3xl">
                歡迎來到虛擬中國南方航空集團
              </p>
              <p className="mt-5 max-w-2xl text-base leading-8 text-white/80 md:text-lg">
                Fly a China-based network built for Infinite Flight pilots:
                major hubs, realistic route variety, partner operations, and a
                fleet ranging from regional jets to long-haul flagships.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-primary hover:bg-sky-50"
                >
                  <Link href="/crew?type=signup">
                    Apply Now
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/about-us">Learn More</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="site-container">
            <div className="grid gap-0 divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0">
              {stats.map((stat) => (
                <div key={stat.label} className="py-6 md:px-8">
                  <p className="text-3xl font-bold text-primary">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-600">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section bg-slate-50">
          <div className="site-container">
            <div className="max-w-3xl">
              <p className="site-eyebrow">Operations</p>
              <h2 className="site-heading mt-3">
                Built for pilots who want variety without losing realism.
              </h2>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {highlights.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="site-card group p-6 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-xl font-bold text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {item.body}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                      {item.action}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="site-eyebrow">Featured network</p>
                <h2 className="site-heading mt-3">
                  Start from major Chinese hubs and branch across the world.
                </h2>
                <p className="site-copy mt-5">
                  Explore China Southern Virtual Group routes from Guangzhou,
                  Beijing Daxing, Xiamen, Chongqing, Chengdu, Shijiazhuang, and
                  Nanchang with aircraft options for short hops and long-haul
                  flights.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Button asChild>
                    <Link href="/operations/hubs">
                      View Hubs
                      <MapPinned className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/operations/routes">Browse Routes</Link>
                  </Button>
                </div>
              </div>
              <FeaturedRouteRotator routes={featuredRoutes} />
            </div>
          </div>
        </section>

        <section className="site-section bg-slate-50">
          <div className="site-container">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="site-eyebrow">CEO message</p>
                <h2 className="site-heading mt-3">Welcome aboard CZVG.</h2>
                <blockquote className="mt-5 border-l-4 border-primary pl-5 text-lg leading-8 text-slate-700">
                  Welcome IF pilots. As the CEO of this virtual airline, I hope
                  CZVG brings you an excellent experience. Our virtual airline
                  has a welcoming community and countless routes to fly. Come
                  and join us in the IF skies.
                </blockquote>
                <p className="mt-4 font-semibold text-slate-950">
                  Nelson Paing, CEO
                </p>
              </div>
              <div className="relative min-h-[320px] overflow-hidden rounded-md md:min-h-[420px]">
                <Image
                  src="https://global.discourse-cdn.com/infiniteflight/original/4X/8/e/f/8eff2df8d46564a0d6ebeb6f6776078af2073377.jpeg"
                  alt="Aircraft on final approach"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-primary py-16 text-white md:py-20">
          <div className="site-container text-center">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-3xl font-bold sm:text-4xl">
                Ready to take flight?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/80 md:text-lg">
                Join our virtual airline today and start your journey through
                one of the largest China-based virtual networks in Infinite
                Flight.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  className="bg-white text-primary hover:bg-white/90"
                >
                  <Link href="/crew?type=signup">Apply Now</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/about-us">Learn More</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
