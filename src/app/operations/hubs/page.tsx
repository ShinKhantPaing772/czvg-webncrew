import Link from "next/link";
import Image from "next/image";
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Link href="/" className="hover:text-blue-700">
                Home
              </Link>
              <span>/</span>
              <Link href="/operations" className="hover:text-blue-700">
                Operations
              </Link>
              <span>/</span>
              <span className="text-gray-700">Hubs</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Our Hubs</h1>
            <div className="max-w-3xl">
              <p className="text-lg text-gray-600 mb-8">
                Learn about our main operational hubs and focus cities across
                China.
              </p>
            </div>
          </div>
        </section>

        {/* Hubs Overview */}
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-6">Our Airlines Network</h2>
              <div className="prose prose-lg">
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

        {/* Main Hubs */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold mb-8">
                China Southern Airlines Main Hubs
              </h2>

              <div className="space-y-16">
                {chinaSouthernHubs.map((hub, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-lg shadow-md overflow-hidden border"
                  >
                    <div className="md:flex flex-col lg:flex-row">
                      <div className="lg:w-1/2">
                        <div className="h-64 lg:h-full relative">
                          <Image
                            src={hub.image || "/placeholder.svg"}
                            alt={hub.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      </div>
                      <div className="lg:w-1/2 p-6">
                        <div className="flex items-center mb-3">
                          <h3 className="text-2xl font-bold">{hub.name}</h3>
                          <span className="ml-2 bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
                            {hub.code}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-6">{hub.description}</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                          <div>
                            <p className="text-sm text-gray-500">Location</p>
                            <p className="font-medium">
                              {hub.details.location}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Terminals</p>
                            <p className="font-medium">
                              {hub.details.terminals}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Runways</p>
                            <p className="font-medium">{hub.details.runways}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">
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
          </div>
        </section>

        {/* Focus Cities */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold mb-8">
                China Southern Airlines Focus Cities
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {chinaSouthernFocusCities.map((city, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-lg shadow-md overflow-hidden border"
                  >
                    <div className="h-48 relative">
                      <Image
                        src={city.image || "/placeholder.svg"}
                        alt={city.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="p-6">
                      <div className="flex items-center mb-3">
                        <h3 className="text-xl font-bold">{city.name}</h3>
                        <span className="ml-2 bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
                          {city.code}
                        </span>
                      </div>
                      <p className="text-gray-600">{city.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Subsidiary Airlines */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold mb-8">
                Subsidiary Airlines Network
              </h2>

              {/* Xiamen Air */}
              <div className="mb-16">
                <h3 className="text-2xl font-bold mb-6">Xiamen Air</h3>
                <div className="space-y-8">
                  {xiamenAirHubs.map((hub, index) => (
                    <div
                      key={index}
                      className="bg-white rounded-lg shadow-md overflow-hidden border"
                    >
                      <div className="md:flex">
                        <div className="md:w-1/2">
                          <div className="h-64 md:h-full relative">
                            <Image
                              src={hub.image || "/placeholder.svg"}
                              alt={hub.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        </div>
                        <div className="md:w-1/2 p-6">
                          <div className="flex items-center mb-3">
                            <h4 className="text-xl font-bold">{hub.name}</h4>
                            <span className="ml-2 bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
                              {hub.code}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-6">
                            {hub.description}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(hub.details).map(([key, value]) => (
                              <div key={key}>
                                <p className="text-sm text-gray-500 capitalize">
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
                        key={index}
                        className="bg-white rounded-lg shadow-md overflow-hidden border"
                      >
                        <div className="h-48 relative">
                          <Image
                            src={city.image || "/placeholder.svg"}
                            alt={city.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="p-6">
                          <div className="flex items-center mb-3">
                            <h4 className="text-xl font-bold">{city.name}</h4>
                            <span className="ml-2 bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
                              {city.code}
                            </span>
                          </div>
                          <p className="text-gray-600">{city.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Other Subsidiaries */}
              {[
                { name: "Chengdu Airlines", hubs: chengduAirHubs },
                { name: "Hebei Airlines", hubs: hebeiAirHubs },
                { name: "Jiangxi Air", hubs: jiangxiAirHubs },
                { name: "Chongqing Airlines", hubs: chongqingAirHubs },
              ].map((subsidiary, index) => (
                <div key={index} className="mb-16">
                  <h3 className="text-2xl font-bold mb-6">{subsidiary.name}</h3>
                  <div className="space-y-8">
                    {subsidiary.hubs.map((hub, hubIndex) => (
                      <div
                        key={hubIndex}
                        className="bg-white rounded-lg shadow-md overflow-hidden border"
                      >
                        <div className="md:flex">
                          <div className="md:w-1/2">
                            <div className="h-64 md:h-full relative">
                              <Image
                                src={hub.image || "/placeholder.svg"}
                                alt={hub.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          </div>
                          <div className="md:w-1/2 p-6">
                            <div className="flex items-center mb-3">
                              <h4 className="text-xl font-bold">{hub.name}</h4>
                              <span className="ml-2 bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
                                {hub.code}
                              </span>
                            </div>
                            <p className="text-gray-600 mb-6">
                              {hub.description}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {Object.entries(hub.details).map(
                                ([key, value]) => (
                                  <div key={key}>
                                    <p className="text-sm text-gray-500 capitalize">
                                      {key}
                                    </p>
                                    <p className="font-medium">{value}</p>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-blue-700 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Explore Our Network?
              </h2>
              <p className="text-xl mb-8">
                Join our virtual airline group today and fly from our hubs to
                destinations around the world.
              </p>
              <div className="flex justify-center space-x-4">
                <Link
                  href="/crew?type=signup"
                  className="bg-white text-blue-700 px-6 py-3 rounded font-medium hover:bg-gray-100 transition-colors"
                >
                  Apply Now
                </Link>
                <Link
                  href="/operations/routes"
                  className="border border-white px-6 py-3 rounded font-medium hover:bg-blue-600 transition-colors"
                >
                  View Routes
                </Link>
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
