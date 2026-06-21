import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/70 to-transparent z-10" />
          <div className="container relative z-20 px-4 py-16 md:py-24 lg:py-32">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col justify-center space-y-5">
                <div className="space-y-2">
                  <h1 className="max-w-3xl text-4xl font-bold tracking-normal text-slate-950 sm:text-5xl md:text-6xl">
                    Welcome to China Southern Virtual Group
                  </h1>
                  <p className="text-2xl font-semibold text-slate-800 sm:text-3xl md:text-4xl">
                    欢迎来到虚拟中国南方航空集团
                  </p>
                  <p className="text-sm font-semibold uppercase text-gray-600 tracking-[0.18em] md:text-base">
                    FLY INTO YOUR DREAMS
                  </p>
                  <div className="flex flex-col gap-2 pt-3 min-[400px]:flex-row">
                    <Button asChild className="bg-primary border border-white text-white">
                      <Link href="/crew?type=signup">Apply Now</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 z-0">
            <Image
              src="https://global.discourse-cdn.com/infiniteflight/optimized/4X/6/3/3/63360f0de130712d1a45d778e1187fea5359831a_2_1640x992.jpeg?height=1080&width=1920"
              alt="Airplane on runway"
              fill
              className="object-cover"
              priority
            />
          </div>
        </section>
        <section className="bg-muted py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-3 lg:gap-12">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                    Our Fleet
                  </h2>
                  <p className="max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    China Southern Virtual Group has 10 different types of
                    aircraft representing 6 different airlines. Explore our
                    diverse fleet of aircraft, from regional jets to wide-body
                    airliners.
                  </p>
                </div>
                <div>
                  <Button asChild variant="link" className="p-0 text-primary">
                    <Link href="/operations/fleet">View Fleet →</Link>
                  </Button>
                </div>
              </div>
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                    Our Routes
                  </h2>
                  <p className="max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    China Southern operates to more than 300 destinations, with
                    a large route network to explore around the world. Discover
                    our destinations and take your next virtual flight.
                  </p>
                </div>
                <div>
                  <Button asChild variant="link" className="p-0 text-primary">
                    <Link href="/operations/routes">Explore Routes →</Link>
                  </Button>
                </div>
              </div>
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                    Our Hubs
                  </h2>
                  <p className="max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    China Southern and its subsidiaries have a number of hubs
                    and focus cities. Become part of our virtual pilot community and
                    start your journey today.
                  </p>
                </div>
                <div>
                  <Button asChild variant="link" className="p-0 text-primary">
                    <Link href="/crew?type=signup">Apply Now →</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                    CEO's Message
                  </h2>
                  <blockquote className="border-l-4 border-primary pl-4 italic">
                    Welcome IF pilots. As the CEO of this virtual airline, I
                    hope CZVG brings you an excellent experience. Our virtual
                    airline has a welcoming community and countless routes to
                    fly. Come and join us in the IF skies. <br />
                  </blockquote>
                  <p className="font-semibold">- Nelson Paing, CEO</p>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative h-[300px] w-full overflow-hidden rounded-lg md:h-[400px]">
                  <Image
                    src="https://global.discourse-cdn.com/infiniteflight/original/4X/8/e/f/8eff2df8d46564a0d6ebeb6f6776078af2073377.jpeg"
                    alt="AP Landing Image"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="bg-primary py-12 md:py-24 lg:py-32 text-white">
          <div className="container px-4 md:px-6 text-center">
            <div className="mx-auto max-w-[800px] space-y-4">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Ready to Take Flight?
              </h2>
              <p className="mx-auto max-w-[600px] text-white/80 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Join our virtual airline today and start your journey in the
                virtual skies.
              </p>
              <div className="flex flex-col gap-2 min-[400px]:flex-row justify-center pt-4">
                <Button asChild className="bg-white text-primary hover:bg-white/90">
                  <Link href="/crew?type=signup">Apply Now</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-white text-white hover:bg-white/20"
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
