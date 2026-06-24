import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPinned } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function HubsPage() {
  // China Southern Airlines hubs data
  const chinaSouthernHubs = [
    {
      name: "Guangzhou Baiyun International Airport",
      code: "ZGGG/CAN",
      image:
        "https://global.discourse-cdn.com/infiniteflight/optimized/4X/9/0/3/9032d2dcfa32d3d3ebab7f79d3a02c0c833fdd58_2_1640x1138.jpeg",
      description:
        "Our primary hub and the main base for China Southern Airlines. Guangzhou Baiyun International Airport is one of the busiest airports in China and serves as our gateway to Southeast Asia, Australia, and beyond.",
      details: {
        location: "Guangzhou, Guangdong, China",
        terminals: "2 terminals",
        runways: "3 runways",
        destinations: "Over 200 destinations",
        airlines: "China Southern Airlines (Main Hub)",
      },
    },
    {
      name: "Beijing Daxing International Airport",
      code: "ZBAD/PKX",
      image:
        "https://global.discourse-cdn.com/infiniteflight/optimized/4X/8/a/4/8a42460742ebb83e6c5a4b49c762a5f7e79be4d2_2_1640x1138.jpeg",
      description:
        "Our secondary hub and a major base for our operations in northern China. Beijing Daxing International Airport is one of the newest and most advanced airports in the world, serving as our gateway to Europe and North America.",
      details: {
        location: "Beijing, China",
        terminals: "1 terminal",
        runways: "4 runways",
        destinations: "Over 150 destinations",
        airlines: "China Southern Airlines (Secondary Hub)",
      },
    },
  ];

  // China Southern Airlines focus cities data
  const chinaSouthernFocusCities = [
    {
      name: "Shanghai Pudong International Airport",
      code: "ZSPD/PVG",
      image:
        "https://global.discourse-cdn.com/infiniteflight/original/4X/3/8/7/387163ed5773701d34c3cc05988e8bf911c8d84c.jpeg",
      description:
        "A major focus city for our operations in eastern China, providing connections to domestic and international destinations.",
    },
    {
      name: "Shenzhen Bao'an International Airport",
      code: "ZGSZ/SZX",
      image:
        "https://global.discourse-cdn.com/infiniteflight/optimized/4X/9/f/8/9f861a65437d33f1f2b0a4277fc902e1cd21acfd_2_1640x1138.jpeg",
      description:
        "An important focus city in southern China, serving as a gateway to Hong Kong and Southeast Asia.",
    },
    {
      name: "Chengdu Shuangliu International Airport",
      code: "ZUUU/CTU",
      image:
        "https://global.discourse-cdn.com/infiniteflight/optimized/4X/d/9/b/d9bd7ef739f70300be02825ed71cac0cfa3c8632_2_1640x1138.jpeg",
      description:
        "A key focus city in western China, providing connections to domestic and international destinations.",
    },
  ];

  const subsidiaryGroups = [
    { name: "Chengdu Airlines", hubs: chengduAirHubs },
    { name: "Hebei Airlines", hubs: hebeiAirHubs },
    { name: "Jiangxi Air", hubs: jiangxiAirHubs },
    { name: "Chongqing Airlines", hubs: chongqingAirHubs },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        <section className="site-section bg-slate-950 text-white">
          <div className="site-container">
            <div className="mb-5 flex items-center gap-2 text-sm text-slate-300">
              <Link href="/" className="hover:text-blue-700">
                Home
              </Link>
              <span>/</span>
              <Link href="/operations" className="hover:text-blue-700">
                Operations
              </Link>
              <span>/</span>
              <span className="text-white">Hubs</span>
            </div>
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase text-sky-200">
                Hubs
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                Main hubs and focus cities across the CZVG network.
              </h1>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Learn about our main operational hubs and focus cities across
                China.
              </p>
            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <p className="site-eyebrow">Airline network</p>
                <h2 className="site-heading mt-3">
                  A network centered around China with several regional bases.
                </h2>
              </div>
              <div className="text-base leading-8 text-slate-600">
                <p>
                  China Southern Virtual Group, along with its subsidiary
                  airlines, operates an extensive network of hubs and focus
                  cities across China. Our airlines include China Southern
                  Airlines, Xiamen Air, Chengdu Airlines, Hebei Airlines,
                  Jiangxi Air, and Chongqing Airlines.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="site-section bg-slate-50">
          <div className="site-container">
            <div className="mb-8">
              <p className="site-eyebrow">Main hubs</p>
              <h2 className="site-heading mt-3">
                China Southern Airlines main hubs
              </h2>
            </div>

              <div className="space-y-6">
                {chinaSouthernHubs.map((hub, index) => (
                  <div
                    key={hub.code}
                    className="site-card overflow-hidden"
                  >
                    <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
                      <div>
                        <div className="relative h-72 lg:h-full">
                          {hub.image ? (
                            <Image
                              src={hub.image}
                              alt={hub.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">
                              Image coming soon
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="p-6 lg:p-8">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="text-2xl font-bold text-slate-950">
                            {hub.name}
                          </h3>
                          <span className="site-badge w-fit">
                            {hub.code}
                          </span>
                        </div>
                        <p className="mt-4 text-slate-600">{hub.description}</p>

                        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-sm text-slate-500">Location</p>
                            <p className="font-medium">
                              {hub.details.location}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-500">Terminals</p>
                            <p className="font-medium">
                              {hub.details.terminals}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-500">Runways</p>
                            <p className="font-medium">{hub.details.runways}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-500">
                              Destinations
                            </p>
                            <p className="font-medium">
                              {hub.details.destinations}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <div className="mb-8">
              <p className="site-eyebrow">Focus cities</p>
              <h2 className="site-heading mt-3">
                China Southern Airlines focus cities
              </h2>
            </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {chinaSouthernFocusCities.map((city, index) => (
                  <div
                    key={city.code}
                    className="site-card overflow-hidden"
                  >
                    <div className="relative h-48">
                        {city.image ? (
                          <Image
                            src={city.image}
                            alt={city.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">
                            Image coming soon
                          </div>
                        )}
                    </div>
                    <div className="p-6">
                      <div className="flex flex-col gap-3">
                        <h3 className="text-xl font-bold text-slate-950">
                          {city.name}
                        </h3>
                        <span className="site-badge w-fit">
                          {city.code}
                        </span>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-600">
                        {city.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
          </div>
        </section>

        <section className="site-section bg-slate-50">
          <div className="site-container">
            <div className="mb-8">
              <p className="site-eyebrow">Subsidiary network</p>
              <h2 className="site-heading mt-3">Subsidiary airline hubs</h2>
            </div>

              <div className="mb-12">
                <h3 className="mb-6 text-2xl font-bold text-slate-950">
                  Xiamen Air
                </h3>
                <div className="space-y-8">
                  {xiamenAirHubs.map((hub, index) => (
                    <div
                      key={hub.code}
                      className="site-card overflow-hidden"
                    >
                      <div className="grid md:grid-cols-2">
                        <div>
                          <div className="relative h-64 md:h-full">
                            {hub.image ? (
                              <Image
                                src={hub.image}
                                alt={hub.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">
                                Image coming soon
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="p-6">
                          <div className="flex flex-col gap-3">
                            <h4 className="text-xl font-bold text-slate-950">
                              {hub.name}
                            </h4>
                            <span className="site-badge w-fit">
                              {hub.code}
                            </span>
                          </div>
                          <p className="mt-4 text-slate-600">
                            {hub.description}
                          </p>
                          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                            {Object.entries(hub.details).map(([key, value]) => (
                              <div key={key}>
                                <p className="text-sm capitalize text-slate-500">
                                  {key}
                                </p>
                                <p className="font-medium">{value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {xiamenAirFocusCities.map((city, index) => (
                      <div
                        key={city.code}
                        className="site-card overflow-hidden"
                      >
                        <div className="relative h-48">
                          {city.image ? (
                            <Image
                              src={city.image}
                              alt={city.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">
                              Image coming soon
                            </div>
                          )}
                        </div>
                        <div className="p-6">
                          <div className="flex flex-col gap-3">
                            <h4 className="text-xl font-bold text-slate-950">
                              {city.name}
                            </h4>
                            <span className="site-badge w-fit">
                              {city.code}
                            </span>
                          </div>
                          <p className="mt-4 text-sm leading-6 text-slate-600">
                            {city.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {subsidiaryGroups.map((subsidiary) => (
                <div key={subsidiary.name} className="mb-12">
                  <h3 className="mb-6 text-2xl font-bold text-slate-950">
                    {subsidiary.name}
                  </h3>
                  <div className="grid gap-5 lg:grid-cols-2">
                    {subsidiary.hubs.map((hub, hubIndex) => (
                      <div
                        key={hub.code}
                        className="site-card overflow-hidden"
                      >
                        <div className="relative h-52 bg-slate-100">
                              {hub.image ? (
                                <Image
                                  src={hub.image}
                                  alt={hub.name}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">
                                  Image coming soon
                                </div>
                              )}
                        </div>
                        <div className="p-6">
                            <div className="flex flex-col gap-3">
                              <h4 className="text-xl font-bold text-slate-950">
                                {hub.name}
                              </h4>
                              <span className="site-badge w-fit">
                                {hub.code}
                              </span>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-slate-600">
                              {hub.description}
                            </p>
                            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                              {Object.entries(hub.details).map(
                                ([key, value]) => (
                                  <div key={key}>
                                    <p className="text-sm capitalize text-slate-500">
                                      {key}
                                    </p>
                                    <p className="font-medium">{value}</p>
                                  </div>
                                )
                              )}
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </section>

        <section className="bg-primary py-16 text-white">
          <div className="site-container text-center">
            <div className="mx-auto max-w-3xl">
              <MapPinned className="mx-auto h-8 w-8 text-white/80" />
              <h2 className="mt-4 text-3xl font-bold">
                Ready to explore our network?
              </h2>
              <p className="mt-4 text-white/80">
                Join our virtual airline group today and fly from our hubs to
                destinations around the world.
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
                  <Link href="/operations/routes">View Routes</Link>
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

// ...existing code ...
// Xiamen Air hubs data
const xiamenAirHubs = [
  {
    name: "Xiamen Gaoqi International Airport",
    code: "ZSAM/XMN",
    image:
      "https://global.discourse-cdn.com/infiniteflight/original/4X/4/8/8/488f45a30435ff8926ff96167ae116577a0b3b28.jpeg",
    description:
      "The primary hub for Xiamen Air operations, serving as a gateway to Southeast Asia and domestic destinations.",
    details: {
      location: "Xiamen, Fujian, China",
      terminals: "4 terminals",
      runways: "1 runway",
      destinations: "Over 50 destinations",
      airlines: "Xiamen Air (Main Hub)",
    },
  },
];

const xiamenAirFocusCities = [
  {
    name: "Fuzhou Changle International Airport",
    code: "ZSFZ/FOC",
    image:
      "https://global.discourse-cdn.com/infiniteflight/optimized/4X/6/4/4/644a9e52b4145ded8a92b101e02e2c85e854455f_2_1600x1200.jpeg",
    description:
      "A major focus city serving eastern China with connections to domestic and international destinations.",
  },
  {
    name: "Hangzhou Xiaoshan International Airport",
    code: "ZSHC/HGH",
    image:
      "https://global.discourse-cdn.com/infiniteflight/original/4X/2/3/b/23b4a442dbcf9fdc8b71784d4d2492e65cc35fd8.jpeg",
    description:
      "An important focus city in the Yangtze River Delta region with extensive domestic network.",
  },
];

// Chengdu Airlines hubs data
const chengduAirHubs = [
  {
    name: "Chengdu Shuangliu International Airport",
    code: "ZUUU/CTU",
    image:
      "https://global.discourse-cdn.com/infiniteflight/optimized/4X/d/9/b/d9bd7ef739f70300be02825ed71cac0cfa3c8632_2_1640x1138.jpeg",
    description:
      "The main operational base for Chengdu Airlines, serving western China with connections to major domestic destinations.",
    details: {
      location: "Chengdu, Sichuan, China",
      terminals: "2 terminals",
      runways: "2 runways",
      destinations: "Over 30 destinations",
      airlines: "Chengdu Airlines (Main Hub)",
    },
  },
];

// Hebei Airlines hubs data
const hebeiAirHubs = [
  {
    name: "Shijiazhuang Zhengding International Airport",
    code: "ZBSJ/SJW",
    image: "",
    description:
      "Primary hub serving Hebei province and northern China region with extensive domestic network.",
    details: {
      location: "Shijiazhuang, Hebei, China",
      terminals: "2 terminals",
      runways: "1 runway",
      destinations: "Over 25 destinations",
      airlines: "Hebei Airlines (Main Hub)",
    },
  },
];

// Jiangxi Air hubs data
const jiangxiAirHubs = [
  {
    name: "Nanchang Changbei International Airport",
    code: "ZSCN/KHN",
    image: "",
    description:
      "Main operational base in Jiangxi province, connecting eastern China destinations with growing network.",
    details: {
      location: "Nanchang, Jiangxi, China",
      terminals: "2 terminals",
      runways: "1 runway",
      destinations: "Over 20 destinations",
      airlines: "Jiangxi Air (Main Hub)",
    },
  },
];

// Chongqing Airlines hubs data
const chongqingAirHubs = [
  {
    name: "Chongqing Jiangbei International Airport",
    code: "ZUCK/CKG",
    image: "",
    description:
      "Primary hub serving southwestern China with connections to major domestic routes and growing international network.",
    details: {
      location: "Chongqing, China",
      terminals: "3 terminals",
      runways: "3 runways",
      destinations: "Over 40 destinations",
      airlines: "Chongqing Airlines (Main Hub)",
    },
  },
];
