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
          <div className="absolute inset-0 bg-gradient-to-r from-white/80 to-transparent z-10" />
          <div className="container relative z-20 px-4 py-12 md:py-24 lg:py-32">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl text-right">
                    Welcome to China Southern Virtual Group
                  </h1>
                  <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl text-right">
                    欢迎来到虚拟中国南方航空集团
                  </h1>
                  <p className=" text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed text-right">
                    FLY INTO YOUR DREAMS
                  </p>
                  <div className="flex flex-col gap-2 min-[400px]:flex-row justify-end">
                    <Button className="bg-primary text-white">
                      Get Flying
                    </Button>
                    <Button variant="outline">Learn More</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 z-0">
            <Image
              src="/placeholder.svg?height=1080&width=1920"
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
                    Explore our diverse fleet of aircraft, from regional jets to
                    wide-body airliners.
                  </p>
                </div>
                <div>
                  <Button variant="link" className="p-0 text-primary">
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
                    Discover our global network of destinations and plan your
                    next virtual flight.
                  </p>
                </div>
                <div>
                  <Button variant="link" className="p-0 text-primary">
                    <Link href="/operations/routes">Explore Routes →</Link>
                  </Button>
                </div>
              </div>
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                    Join Us
                  </h2>
                  <p className="max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    Become part of our virtual pilot community and start your
                    journey today.
                  </p>
                </div>
                <div>
                  <Button variant="link" className="p-0 text-primary">
                    Apply Now →
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
                    Welcome IF Pilots, As the CEO of this virtual airline. I
                    hope this VA brings you an excellent experience. Our virtual
                    airline has a significant number of routes and aircraft to
                    fly. Come and join us in the IF skies. And Stay Safe, Take
                    Care
                  </blockquote>
                  <p className="font-semibold">- Yang-le-duo, CEO</p>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative h-[300px] w-full overflow-hidden rounded-lg md:h-[400px]">
                  <Image
                    src="/placeholder.svg?height=400&width=600"
                    alt="CEO portrait"
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
                <Button className="bg-white text-primary hover:bg-white/90">
                  Apply Now
                </Button>
                <Button
                  variant="outline"
                  className="border-white text-white hover:bg-white/20"
                >
                  Learn More
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
