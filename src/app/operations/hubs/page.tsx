import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function HubsPage() {
  // Sample hubs data
  const hubs = [
    {
      name: "Guangzhou Baiyun International Airport",
      code: "CAN",
      image: "/placeholder.svg?height=500&width=800",
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
      code: "PKX",
      image: "/placeholder.svg?height=500&width=800",
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

  // Sample focus cities data
  const focusCities = [
    {
      name: "Shanghai Pudong International Airport",
      code: "PVG",
      image: "/placeholder.svg?height=400&width=600",
      description:
        "A major focus city for our operations in eastern China, providing connections to domestic and international destinations.",
    },
    {
      name: "Shenzhen Bao'an International Airport",
      code: "SZX",
      image: "/placeholder.svg?height=400&width=600",
      description:
        "An important focus city in southern China, serving as a gateway to Hong Kong and Southeast Asia.",
    },
    {
      name: "Chengdu Shuangliu International Airport",
      code: "CTU",
      image: "/placeholder.svg?height=400&width=600",
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
              <h2 className="text-3xl font-bold mb-6">Operational Hubs</h2>
              <div className="prose prose-lg">
                <p>
                  China Southern Virtual Group operates from two main hubs:
                  Guangzhou Baiyun International Airport (CAN) and Beijing
                  Daxing International Airport (PKX). These hubs serve as the
                  central points of our operations, connecting passengers to
                  destinations across China and around the world.
                </p>
                <p>
                  In addition to our main hubs, we also maintain several focus
                  cities throughout China, allowing us to provide comprehensive
                  coverage of the Chinese market and efficient connections to
                  international destinations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Main Hubs */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold mb-8">Main Hubs</h2>

              <div className="space-y-16">
                {hubs.map((hub, index) => (
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
              <h2 className="text-3xl font-bold mb-8">Focus Cities</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {focusCities.map((city, index) => (
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
                      <p className="text-gray-600 mb-4">{city.description}</p>
                    </div>
                  </div>
                ))}
              </div>
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
                  href="/join-us"
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
