import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function FleetPage() {
  // Sample fleet data
  const fleetCategories = [
    {
      category: "Wide-body Aircraft",
      aircraft: [
        {
          type: "Boeing 777-300ER",
          image: "/placeholder.svg?height=300&width=500",
          description:
            "Our flagship long-haul aircraft serving international routes to Europe, North America, and Australia.",
        },
        {
          type: "Airbus A350-900",
          image: "/placeholder.svg?height=300&width=500",
          description:
            "Latest addition to our long-haul fleet, offering superior fuel efficiency and passenger comfort.",
        },
        {
          type: "Boeing 787-9 Dreamliner",
          image: "/placeholder.svg?height=300&width=500",
          description:
            "Advanced composite aircraft serving medium to long-haul routes with enhanced passenger experience.",
        },
      ],
    },
    {
      category: "Narrow-body Aircraft",
      aircraft: [
        {
          type: "Airbus A320neo",
          image: "/placeholder.svg?height=300&width=500",
          description:
            "Latest generation A320 serving domestic and regional routes with improved fuel efficiency.",
        },
        {
          type: "Boeing 737-800",
          image: "/placeholder.svg?height=300&width=500",
          description:
            "Workhorse of our domestic network, connecting major cities across China.",
        },
      ],
    },
    {
      category: "Regional Aircraft",
      aircraft: [
        {
          type: "Embraer E190",
          image: "/placeholder.svg?height=300&width=500",
          description:
            "Regional jet serving smaller cities and lower-demand routes throughout China.",
        },
      ],
    },
    {
      category: "Historical Fleet",
      aircraft: [
        {
          type: "Boeing 747-400",
          image: "/placeholder.svg?height=300&width=500",
          description:
            "The iconic Queen of the Skies that served our long-haul routes from 1989 to 2019, connecting China to the world.",
        },
        {
          type: "Airbus A340-300",
          image: "/placeholder.svg?height=300&width=500",
          description:
            "A reliable four-engine aircraft that operated our long-haul routes from 1995 to 2015.",
        },
        {
          type: "McDonnell Douglas MD-82",
          image: "/placeholder.svg?height=300&width=500",
          description:
            "A classic narrow-body aircraft that served our domestic routes through the 1990s.",
        },
      ],
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
              <span className="text-gray-700">Fleet</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Our Fleet</h1>
            <div className="max-w-3xl">
              <p className="text-lg text-gray-600 mb-8">
                Explore our diverse fleet of aircraft, from regional jets to
                wide-body airliners.
              </p>
            </div>
          </div>
        </section>

        {/* Fleet Overview */}
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-6">Fleet Overview</h2>
              <div className="prose prose-lg">
                <p>
                  China Southern Virtual Group operates a diverse fleet of
                  aircraft to serve our extensive network of destinations. Our
                  fleet includes wide-body aircraft for long-haul international
                  routes, narrow-body aircraft for domestic and regional routes,
                  and regional jets for shorter routes to smaller cities.
                </p>
                <p>
                  Our virtual pilots have the opportunity to fly a wide variety
                  of aircraft types, providing a rich and diverse flying
                  experience.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Fleet Categories */}
        {fleetCategories.map((category, categoryIndex) => (
          <section key={categoryIndex} className="py-16">
            <div className="container mx-auto px-4">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold mb-8">{category.category}</h2>
                <div className="space-y-12">
                  {category.aircraft.map((aircraft, aircraftIndex) => (
                    <div
                      key={aircraftIndex}
                      className="bg-white rounded-lg shadow-md overflow-hidden border"
                    >
                      <div className="md:flex">
                        <div className="md:w-2/3 p-6">
                          <h3 className="text-2xl font-bold mb-3">
                            {aircraft.type}
                          </h3>
                          <p className="text-gray-600 mb-4">
                            {aircraft.description}
                          </p>
                        </div>
                        <div className="md:w-1/3">
                          <div className="h-64 md:h-full relative">
                            <Image
                              src={aircraft.image || "/placeholder.svg"}
                              alt={aircraft.type}
                              fill
                              className="object-cover"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ))}

        {/* CTA Section */}
        <section className="py-16 bg-blue-700 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Fly Our Fleet?
              </h2>
              <p className="text-xl mb-8">
                Join our virtual airline group today and experience flying these
                amazing aircraft.
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
                  Explore Routes
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
